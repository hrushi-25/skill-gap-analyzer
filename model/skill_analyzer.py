import os
import re

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(BASE_DIR, "data", "job_roles.csv")

# alias (as written in resumes) -> canonical skill (lowercase, as in the CSV).
# Aliases whose target skill is not in your CSV are ignored automatically,
# so it is safe to add more entries.
RAW_ALIASES = {
    "js": "javascript",
    "ecmascript": "javascript",
    "ts": "typescript",
    "node": "node.js",
    "nodejs": "node.js",
    "reactjs": "react",
    "react.js": "react",
    "postgres": "postgresql",
    "restful": "rest api",
    "restful api": "rest api",
    "restful apis": "rest api",
    "rest apis": "rest api",
    "cpp": "c++",
    "object oriented programming": "oop",
    "object-oriented programming": "oop",
    "object oriented": "oop",
    "unit testing": "testing",
    "unit tests": "testing",
    "test automation": "testing",
    "springboot": "spring boot",
    "microservice": "microservices",
    "multi-threading": "multithreading",
    "multi threading": "multithreading",
    "data structure": "data structures",
    "algorithm": "algorithms",
    "a11y": "web accessibility",
    "accessibility": "web accessibility",
    "ml": "machine learning",
    "dl": "deep learning",
    "nlp": "natural language processing",
    "k8s": "kubernetes",
}

# Characters that, when touching a match, mean it is part of a longer word
# (so "java" does not match inside "javascript", "c" not inside "c++").
_BOUNDARY = r"[A-Za-z0-9+#]"


class SkillGapAnalyzer:

    def __init__(self):
        raw = pd.read_csv(CSV_PATH)
        raw["skills"] = raw["skills"].fillna("")

        # skill (lowercase) -> display name as written in the CSV ("REST API")
        self.display_names = {}
        # role (lowercase) -> {"name": original role, "skills": {lower: display}}
        self._roles = {}

        for _, row in raw.iterrows():
            role = " ".join(str(row["job_role"]).split())
            if not role or role.lower() == "nan":
                continue

            entry = self._roles.setdefault(
                role.lower(), {"name": role, "skills": {}}
            )

            for skill in str(row["skills"]).split(","):
                skill = " ".join(skill.split())
                if skill:
                    entry["skills"].setdefault(skill.lower(), skill)
                    self.display_names.setdefault(skill.lower(), skill)

        # One row per role (duplicate role rows are merged).
        self.data = pd.DataFrame(
            [
                {
                    "job_role": entry["name"],
                    "skills": ", ".join(entry["skills"].keys()),
                }
                for entry in self._roles.values()
            ],
            columns=["job_role", "skills"],
        )

        self.aliases = {
            alias: target
            for alias, target in RAW_ALIASES.items()
            if target in self.display_names
        }

        self._patterns = self._build_patterns()

        # Each comma-separated skill is one token ("machine learning" stays whole).
        self.vectorizer = TfidfVectorizer(analyzer=self._skill_tokens)
        self.skill_vectors = self.vectorizer.fit_transform(self.data["skills"])

    # ------------------------------------------------------------------
    # Normalisation helpers
    # ------------------------------------------------------------------
    def normalize_skill(self, skill):
        skill = " ".join(str(skill).lower().split())
        return self.aliases.get(skill, skill)

    def clean_skills(self, skills):
        return {
            self.normalize_skill(skill)
            for skill in str(skills).split(",")
            if skill.strip()
        }

    def _skill_tokens(self, text):
        return [
            self.normalize_skill(skill)
            for skill in text.split(",")
            if skill.strip()
        ]

    # ------------------------------------------------------------------
    # Resume skill extraction
    # ------------------------------------------------------------------
    def _build_patterns(self):
        terms = [(skill, skill) for skill in self.display_names]
        terms += [(alias, target) for alias, target in self.aliases.items()]

        patterns = []
        for term, key in terms:
            parts = [re.escape(part) for part in term.split()]
            body = r"[\s\-]+".join(parts)

            # One-letter skills (R, C) are matched case-sensitively so that
            # a lone "r" or "c" in normal text is not treated as a skill.
            case_sensitive = len(term) == 1 and term.isalpha()
            if case_sensitive:
                body = re.escape(term.upper())

            regex = re.compile(
                rf"(?<!{_BOUNDARY}){body}(?!{_BOUNDARY})",
                0 if case_sensitive else re.IGNORECASE,
            )
            patterns.append((key, regex))
        return patterns

    def extract_skills(self, text):
        """Return known skills found in free text, in order of appearance."""
        if not text:
            return []

        flat = " ".join(text.split())
        found = {}

        for key, regex in self._patterns:
            match = regex.search(flat)
            if match and (key not in found or match.start() < found[key]):
                found[key] = match.start()

        ordered = sorted(found.items(), key=lambda item: item[1])
        return [self.display_names[key] for key, _ in ordered]

    # ------------------------------------------------------------------
    # Lookups for the Roles page
    # ------------------------------------------------------------------
    def get_known_skills(self):
        return sorted(self.display_names.values(), key=str.lower)

    def get_roles(self):
        return sorted(
            (entry["name"] for entry in self._roles.values()), key=str.lower
        )

    def get_role_skills(self, target_role):
        entry = self._roles.get(" ".join(str(target_role).lower().split()))
        if entry is None:
            return None
        return {
            "job_role": entry["name"],
            "skills": list(entry["skills"].values()),
        }

    # ------------------------------------------------------------------
    # Analysis
    # ------------------------------------------------------------------
    def analyze(self, user_skills, target_role):
        """Compare the user's skills with one role.

        Returns None when the role does not exist.
        """
        entry = self._roles.get(" ".join(str(target_role).lower().split()))
        if entry is None:
            return None

        user_skill_set = self.clean_skills(user_skills)

        matched, missing = [], []
        for key, display in entry["skills"].items():
            if self.normalize_skill(key) in user_skill_set:
                matched.append(display)
            else:
                missing.append(display)

        required = len(entry["skills"])
        percent = round(len(matched) / required * 100, 2) if required else 0.0

        return {
            "job_role": entry["name"],
            "match_percentage": percent,
            "matched_skills": matched,
            "missing_skills": missing,
            "matched_count": len(matched),
            "missing_count": len(missing),
            "required_count": required,
        }

    # ------------------------------------------------------------------
    # Role recommendations
    # ------------------------------------------------------------------
    def recommend_roles(self, user_skills, top_n=5):
        """Return a DataFrame with columns job_role and similarity (0-1)."""
        empty = pd.DataFrame(columns=["job_role", "similarity"])

        user_skill_set = self.clean_skills(user_skills)
        if not user_skill_set:
            return empty

        user_vector = self.vectorizer.transform(
            [", ".join(sorted(user_skill_set))]
        )
        scores = cosine_similarity(user_vector, self.skill_vectors).flatten()

        results = self.data[["job_role"]].copy()
        results["similarity"] = scores
        results = results[results["similarity"] > 0]

        if results.empty:
            return empty

        return (
            results.sort_values("similarity", ascending=False)
            .head(top_n)
            .reset_index(drop=True)
        )