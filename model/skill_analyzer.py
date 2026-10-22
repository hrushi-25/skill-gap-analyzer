import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class SkillGapAnalyzer:

    def __init__(self):
        self.data = pd.read_csv("data/job_roles.csv")

        self.data["skills"] = (
            self.data["skills"]
            .fillna("")
            .str.lower()
        )

        self.vectorizer = TfidfVectorizer()

        self.skill_vectors = self.vectorizer.fit_transform(
            self.data["skills"]
        )

    def clean_skills(self, skills):

        return {
            skill.strip().lower()
            for skill in skills.split(",")
            if skill.strip()
        }

    def analyze(self, user_skills, target_role):

        user_skill_set = self.clean_skills(user_skills)

        job = self.data[
            self.data["job_role"].str.lower()
            == target_role.lower()
        ]

        if job.empty:
            return None

        required_skills = self.clean_skills(
            job.iloc[0]["skills"]
        )

        matched_skills = (
            user_skill_set.intersection(required_skills)
        )

        missing_skills = (
            required_skills - user_skill_set
        )

        total_skills = len(required_skills)

        match_percentage = (
            len(matched_skills) / total_skills
        ) * 100

        gap_percentage = (
            len(missing_skills) / total_skills
        ) * 100

        return {
            "job_role": target_role,
            "required_skills": sorted(required_skills),
            "matched_skills": sorted(matched_skills),
            "missing_skills": sorted(missing_skills),
            "match_percentage": round(match_percentage, 2),
            "gap_percentage": round(gap_percentage, 2)
        }

    def recommend_roles(self, user_skills):

        user_vector = self.vectorizer.transform(
            [user_skills.lower()]
        )

        similarity_scores = cosine_similarity(
            user_vector,
            self.skill_vectors
        )[0]

        results = self.data.copy()

        results["similarity"] = similarity_scores

        results = results.sort_values(
            by="similarity",
            ascending=False
        )

        return results[
            ["job_role", "similarity"]
        ].head(5)