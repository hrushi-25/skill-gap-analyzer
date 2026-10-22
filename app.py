import logging
import math

import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request

from model.skill_analyzer import SkillGapAnalyzer

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Initialize the Skill Gap Analyzer once at startup
analyzer = SkillGapAnalyzer()


# ---------------------------------------
# Helpers
# ---------------------------------------
def to_builtin(obj):
    """Convert numpy / pandas / NaN values into plain JSON-safe Python types.

    Without this, jsonify() raises "Object of type int64 is not JSON serializable"
    and NaN values produce invalid JSON that breaks response.json() in the browser.
    """
    if isinstance(obj, pd.DataFrame):
        return to_builtin(obj.to_dict(orient="records"))
    if isinstance(obj, pd.Series):
        return to_builtin(obj.to_dict())
    if isinstance(obj, dict):
        return {str(k): to_builtin(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [to_builtin(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return to_builtin(obj.tolist())
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        value = float(obj)
        return None if math.isnan(value) or math.isinf(value) else value
    if isinstance(obj, np.bool_):
        return bool(obj)
    return obj


def skills_to_string(value):
    """Accept either 'python, sql' or ['python', 'sql'] and return a clean string."""
    if isinstance(value, (list, tuple, set)):
        return ", ".join(str(s).strip() for s in value if str(s).strip())
    if isinstance(value, str):
        return value.strip()
    return ""


def error_response(message, status):
    return jsonify({"error": message}), status


# ---------------------------------------
# Home Page
# ---------------------------------------
@app.route("/")
def home():
    roles = sorted(analyzer.data["job_role"].dropna().astype(str).unique().tolist())
    return render_template("index.html", roles=roles)


# ---------------------------------------
# Analyze Skill Gap
# ---------------------------------------
@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        data = request.get_json(silent=True) or {}

        user_skills = skills_to_string(data.get("skills", ""))
        target_role = str(data.get("target_role", "")).strip()

        if not user_skills:
            return error_response("Please enter your skills.", 400)
        if not target_role:
            return error_response("Please select a target job role.", 400)

        result = analyzer.analyze(user_skills, target_role)

        if result is None:
            return error_response("Selected job role was not found.", 404)

        return jsonify(to_builtin(result))

    except Exception as exc:
        app.logger.exception("Error in /analyze")
        return error_response(str(exc), 500)


# ---------------------------------------
# Recommend Job Roles
# ---------------------------------------
@app.route("/recommend", methods=["POST"])
def recommend():
    try:
        data = request.get_json(silent=True) or {}

        user_skills = skills_to_string(data.get("skills", ""))
        if not user_skills:
            return error_response("Please enter your skills.", 400)

        results = analyzer.recommend_roles(user_skills)

        if isinstance(results, pd.DataFrame):
            results = results.copy()
            # similarity (0-1) -> percentage
            if "similarity" in results.columns:
                results["similarity"] = (results["similarity"] * 100).round(2)

        return jsonify(to_builtin(results))

    except Exception as exc:
        app.logger.exception("Error in /recommend")
        return error_response(str(exc), 500)


# ---------------------------------------
# API: Get Available Job Roles
# ---------------------------------------
@app.route("/api/roles", methods=["GET"])
def get_roles():
    roles = sorted(analyzer.data["job_role"].dropna().astype(str).unique().tolist())
    return jsonify({"roles": roles})


# ---------------------------------------
# Run Flask Application
# ---------------------------------------
if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)