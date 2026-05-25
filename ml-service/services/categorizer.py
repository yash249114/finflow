# ml-service/services/categorizer.py
"""Transaction categorization using TF-IDF + LogisticRegression."""

import os
import logging
from pathlib import Path

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

logger = logging.getLogger(__name__)

# ─── Synthetic Training Data ────────────────────────────────
# 300+ labeled examples covering 10 categories for SMB transactions
TRAINING_DATA: list[tuple[str, str]] = [
    # Revenue
    ("Client Payment", "Revenue"),
    ("Invoice Payment", "Revenue"),
    ("Customer Payment", "Revenue"),
    ("Product Sale", "Revenue"),
    ("Service Revenue", "Revenue"),
    ("Consulting Fee Received", "Revenue"),
    ("Monthly Retainer Payment", "Revenue"),
    ("Contract Payment Received", "Revenue"),
    ("Client Payment - Acme Corp", "Revenue"),
    ("Client Payment - Beta Corp", "Revenue"),
    ("Client Payment - Gamma Ltd", "Revenue"),
    ("Client Payment - Delta Inc", "Revenue"),
    ("Invoice 1042 Payment", "Revenue"),
    ("Sales Revenue", "Revenue"),
    ("Subscription Revenue", "Revenue"),
    ("License Fee Payment", "Revenue"),
    ("Freelance Payment Received", "Revenue"),
    ("Project Milestone Payment", "Revenue"),
    ("Deposit Received", "Revenue"),
    ("Commission Earned", "Revenue"),
    ("Royalty Payment", "Revenue"),
    ("Affiliate Revenue", "Revenue"),
    ("Ad Revenue", "Revenue"),
    ("Sponsorship Income", "Revenue"),
    ("Grant Received", "Revenue"),
    ("Refund Received", "Revenue"),
    ("Accounts Receivable Collection", "Revenue"),
    ("Wire Transfer Received", "Revenue"),
    ("ACH Payment Received", "Revenue"),
    ("Check Deposit", "Revenue"),
    # Payroll
    ("Payroll", "Payroll"),
    ("Salary Payment", "Payroll"),
    ("Employee Wages", "Payroll"),
    ("Payroll February", "Payroll"),
    ("Payroll March", "Payroll"),
    ("Payroll January", "Payroll"),
    ("Staff Salaries", "Payroll"),
    ("Contractor Payment Payroll", "Payroll"),
    ("Bonus Payment", "Payroll"),
    ("Payroll Tax", "Payroll"),
    ("Benefits Payment", "Payroll"),
    ("Health Insurance Premium", "Payroll"),
    ("401k Contribution", "Payroll"),
    ("Workers Comp Insurance", "Payroll"),
    ("Payroll Processing Fee", "Payroll"),
    ("PTO Payout", "Payroll"),
    ("Severance Payment", "Payroll"),
    ("Payroll Direct Deposit", "Payroll"),
    ("Employee Reimbursement", "Payroll"),
    ("Gusto Payroll", "Payroll"),
    ("ADP Payroll Service", "Payroll"),
    ("Payroll Withholding", "Payroll"),
    ("Social Security Tax", "Payroll"),
    ("Medicare Tax Payment", "Payroll"),
    ("Unemployment Insurance", "Payroll"),
    ("Wage Garnishment", "Payroll"),
    # Infrastructure
    ("AWS Monthly Bill", "Infrastructure"),
    ("AWS", "Infrastructure"),
    ("Amazon Web Services", "Infrastructure"),
    ("Google Cloud Platform", "Infrastructure"),
    ("Azure Subscription", "Infrastructure"),
    ("Google Workspace", "Infrastructure"),
    ("Google Workspace Business", "Infrastructure"),
    ("Microsoft 365 Subscription", "Infrastructure"),
    ("Notion Subscription", "Infrastructure"),
    ("Linear Subscription", "Infrastructure"),
    ("Notion + Linear Subscriptions", "Infrastructure"),
    ("SaaS Tools", "Infrastructure"),
    ("Slack Business", "Infrastructure"),
    ("GitHub Enterprise", "Infrastructure"),
    ("Jira Subscription", "Infrastructure"),
    ("Datadog Monitoring", "Infrastructure"),
    ("Cloudflare Plan", "Infrastructure"),
    ("Domain Registration", "Infrastructure"),
    ("SSL Certificate", "Infrastructure"),
    ("Heroku Hosting", "Infrastructure"),
    ("DigitalOcean Droplet", "Infrastructure"),
    ("Vercel Pro Plan", "Infrastructure"),
    ("Netlify Hosting", "Infrastructure"),
    ("Server Hosting", "Infrastructure"),
    ("VPS Monthly", "Infrastructure"),
    ("CDN Service", "Infrastructure"),
    ("Database Hosting", "Infrastructure"),
    ("MongoDB Atlas", "Infrastructure"),
    ("Redis Cloud", "Infrastructure"),
    ("Twilio Communications", "Infrastructure"),
    ("SendGrid Email", "Infrastructure"),
    ("Stripe Processing Fee", "Infrastructure"),
    # Office
    ("Office Supplies", "Office"),
    ("Office Supplies - Staples", "Office"),
    ("Office Rent", "Office"),
    ("Office Rent March", "Office"),
    ("Office Rent February", "Office"),
    ("Office Lease Payment", "Office"),
    ("Furniture Purchase", "Office"),
    ("Desk Supplies", "Office"),
    ("Printer Ink", "Office"),
    ("Paper and Stationery", "Office"),
    ("Office Cleaning Service", "Office"),
    ("Janitorial Services", "Office"),
    ("Office Equipment", "Office"),
    ("Computer Purchase", "Office"),
    ("Monitor Purchase", "Office"),
    ("Keyboard and Mouse", "Office"),
    ("Printer Purchase", "Office"),
    ("Office Maintenance", "Office"),
    ("Coworking Space", "Office"),
    ("WeWork Membership", "Office"),
    ("Office Snacks", "Office"),
    ("Coffee Machine Supplies", "Office"),
    ("Office Decoration", "Office"),
    ("Security System Monthly", "Office"),
    ("Office Insurance", "Office"),
    ("Parking Permit", "Office"),
    ("Office Renovation", "Office"),
    ("Standing Desk", "Office"),
    # Meals
    ("Team Lunch", "Meals"),
    ("Client Dinner", "Meals"),
    ("Business Lunch", "Meals"),
    ("Team Lunch", "Meals"),
    ("Office Catering", "Meals"),
    ("Restaurant Meeting", "Meals"),
    ("Coffee Meeting", "Meals"),
    ("Uber Eats", "Meals"),
    ("DoorDash Order", "Meals"),
    ("Grubhub Delivery", "Meals"),
    ("Team Dinner", "Meals"),
    ("Company Lunch", "Meals"),
    ("Client Entertainment Dinner", "Meals"),
    ("Breakfast Meeting", "Meals"),
    ("Team Happy Hour", "Meals"),
    ("Holiday Party Catering", "Meals"),
    ("Team Building Dinner", "Meals"),
    ("Working Lunch", "Meals"),
    ("Snack Delivery", "Meals"),
    ("Coffee Shop", "Meals"),
    ("Team Outing Food", "Meals"),
    ("Pizza Friday", "Meals"),
    ("Company Event Catering", "Meals"),
    ("Celebration Dinner", "Meals"),
    ("Client Lunch Meeting", "Meals"),
    # Marketing
    ("Facebook Ads", "Marketing"),
    ("Facebook Ads Campaign", "Marketing"),
    ("Google Ads", "Marketing"),
    ("Google Ads Campaign", "Marketing"),
    ("LinkedIn Ads", "Marketing"),
    ("Instagram Advertising", "Marketing"),
    ("Twitter Ads", "Marketing"),
    ("TikTok Advertising", "Marketing"),
    ("Social Media Marketing", "Marketing"),
    ("Content Marketing", "Marketing"),
    ("SEO Services", "Marketing"),
    ("PR Agency Fee", "Marketing"),
    ("Marketing Agency", "Marketing"),
    ("Brand Design", "Marketing"),
    ("Logo Design", "Marketing"),
    ("Business Cards", "Marketing"),
    ("Brochure Printing", "Marketing"),
    ("Trade Show Booth", "Marketing"),
    ("Conference Sponsorship", "Marketing"),
    ("Email Marketing Platform", "Marketing"),
    ("Mailchimp Subscription", "Marketing"),
    ("HubSpot Marketing", "Marketing"),
    ("Influencer Marketing", "Marketing"),
    ("Video Production", "Marketing"),
    ("Photography Services", "Marketing"),
    ("Marketing Collateral", "Marketing"),
    ("Billboard Advertising", "Marketing"),
    ("Radio Advertising", "Marketing"),
    ("Podcast Sponsorship", "Marketing"),
    ("Webinar Platform", "Marketing"),
    # Contractors
    ("Contractor Invoice", "Contractors"),
    ("Contractor Invoice - Design", "Contractors"),
    ("Contractor Invoice - Design Work", "Contractors"),
    ("Contractor Invoice - Dev Work", "Contractors"),
    ("Freelancer Payment", "Contractors"),
    ("Design Contractor", "Contractors"),
    ("Development Contractor", "Contractors"),
    ("Consulting Services", "Contractors"),
    ("Legal Services", "Contractors"),
    ("Accounting Services", "Contractors"),
    ("Tax Preparation", "Contractors"),
    ("Bookkeeping Services", "Contractors"),
    ("IT Consulting", "Contractors"),
    ("Security Audit", "Contractors"),
    ("Copywriting Services", "Contractors"),
    ("Translation Services", "Contractors"),
    ("Virtual Assistant", "Contractors"),
    ("Graphic Design Services", "Contractors"),
    ("Web Development Services", "Contractors"),
    ("App Development Services", "Contractors"),
    ("UX Research Services", "Contractors"),
    ("Data Analysis Services", "Contractors"),
    ("Photography Freelancer", "Contractors"),
    ("Video Editing Services", "Contractors"),
    ("Writing Services", "Contractors"),
    ("Fiverr Services", "Contractors"),
    ("Upwork Freelancer", "Contractors"),
    ("Toptal Contractor", "Contractors"),
    ("Legal Retainer", "Contractors"),
    ("CPA Services", "Contractors"),
    # Utilities
    ("Electricity Bill", "Utilities"),
    ("Electric Company Payment", "Utilities"),
    ("Gas Bill", "Utilities"),
    ("Water Bill", "Utilities"),
    ("Internet Service", "Utilities"),
    ("Phone Bill", "Utilities"),
    ("Mobile Phone Plan", "Utilities"),
    ("AT&T Business", "Utilities"),
    ("Verizon Business", "Utilities"),
    ("T-Mobile Business", "Utilities"),
    ("Comcast Internet", "Utilities"),
    ("Spectrum Internet", "Utilities"),
    ("Heating Bill", "Utilities"),
    ("Cooling Bill", "Utilities"),
    ("Waste Management", "Utilities"),
    ("Sewer Service", "Utilities"),
    ("Cable TV", "Utilities"),
    ("Landline Phone", "Utilities"),
    ("Security Monitoring", "Utilities"),
    ("Alarm System Monthly", "Utilities"),
    ("Pest Control", "Utilities"),
    ("HVAC Maintenance", "Utilities"),
    ("Plumbing Service", "Utilities"),
    ("Electrical Service", "Utilities"),
    ("Natural Gas", "Utilities"),
    # Travel
    ("Business Travel", "Travel"),
    ("Business Travel - Flights", "Travel"),
    ("Flight Booking", "Travel"),
    ("Hotel Booking", "Travel"),
    ("Airbnb Booking", "Travel"),
    ("Car Rental", "Travel"),
    ("Uber Ride", "Travel"),
    ("Lyft Ride", "Travel"),
    ("Taxi Fare", "Travel"),
    ("Airport Parking", "Travel"),
    ("Conference Travel", "Travel"),
    ("Client Visit Travel", "Travel"),
    ("Train Ticket", "Travel"),
    ("Amtrak Booking", "Travel"),
    ("Gas Station", "Travel"),
    ("Toll Road", "Travel"),
    ("Parking Fee", "Travel"),
    ("Mileage Reimbursement", "Travel"),
    ("Travel Insurance", "Travel"),
    ("Luggage Purchase", "Travel"),
    ("Per Diem", "Travel"),
    ("International Travel", "Travel"),
    ("Passport Renewal", "Travel"),
    ("Visa Application", "Travel"),
    ("Airport Lounge", "Travel"),
    # Other
    ("Miscellaneous", "Other"),
    ("Bank Fee", "Other"),
    ("Wire Transfer Fee", "Other"),
    ("ATM Fee", "Other"),
    ("Interest Payment", "Other"),
    ("Loan Payment", "Other"),
    ("Insurance Premium", "Other"),
    ("Liability Insurance", "Other"),
    ("Business License", "Other"),
    ("Permit Fee", "Other"),
    ("Tax Payment", "Other"),
    ("State Tax", "Other"),
    ("Federal Tax", "Other"),
    ("Sales Tax Payment", "Other"),
    ("Late Fee", "Other"),
    ("Penalty Payment", "Other"),
    ("Donation", "Other"),
    ("Charity Contribution", "Other"),
    ("Professional Development", "Other"),
    ("Training Course", "Other"),
    ("Conference Ticket", "Other"),
    ("Book Purchase", "Other"),
    ("Subscription Renewal", "Other"),
    ("Equipment Repair", "Other"),
    ("Vehicle Maintenance", "Other"),
]

MODEL_DIR = Path("models")
MODEL_PATH = MODEL_DIR / "categorizer.joblib"
CONFIDENCE_THRESHOLD = 0.20


class Categorizer:
    """Transaction categorizer using TF-IDF + Logistic Regression."""

    def __init__(self) -> None:
        self.pipeline: Pipeline | None = None
        self._load_or_train()

    def _load_or_train(self) -> None:
        """Load model from disk or train a new one."""
        MODEL_DIR.mkdir(exist_ok=True)

        if MODEL_PATH.exists():
            logger.info("Loading categorizer model from %s", MODEL_PATH)
            self.pipeline = joblib.load(MODEL_PATH)
            logger.info("Categorizer model loaded successfully")
        else:
            logger.info("Training new categorizer model...")
            self._train()
            logger.info("Categorizer model trained and saved to %s", MODEL_PATH)

    def _train(self) -> None:
        """Train the model on synthetic data and save to disk."""
        descriptions = [d for d, _ in TRAINING_DATA]
        categories = [c for _, c in TRAINING_DATA]

        self.pipeline = Pipeline([
            ("tfidf", TfidfVectorizer(
                max_features=5000,
                ngram_range=(1, 2),
                stop_words="english",
                lowercase=True,
            )),
            ("clf", LogisticRegression(
                max_iter=1000,
                C=1.0,
                class_weight="balanced",
                random_state=42,
            )),
        ])

        self.pipeline.fit(descriptions, categories)
        joblib.dump(self.pipeline, MODEL_PATH)

    def classify(self, descriptions: list[str]) -> list[str]:
        """Classify transaction descriptions into categories.
        
        Returns 'Other' for any prediction with confidence below threshold.
        """
        if self.pipeline is None:
            return ["Other"] * len(descriptions)

        probabilities = self.pipeline.predict_proba(descriptions)
        classes = self.pipeline.classes_

        results: list[str] = []
        for probs in probabilities:
            max_idx = int(np.argmax(probs))
            max_prob = probs[max_idx]

            if max_prob < CONFIDENCE_THRESHOLD:
                results.append("Other")
            else:
                results.append(classes[max_idx])

        return results

    @property
    def is_loaded(self) -> bool:
        return self.pipeline is not None
