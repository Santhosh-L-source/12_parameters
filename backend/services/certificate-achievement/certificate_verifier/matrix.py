"""
Central Approved Certification Matrix.
Each key is the canonical lowercase credential name.
Add or remove entries here to update what the system accepts.
"""

APPROVED_MATRIX = {
    # ── NPTEL / SWAYAM ──────────────────────────────────────────────────
    "nptel": {
        "tier": "Academic",
        "issuer": "NPTEL / IIT / IISc",
        "issuer_domains": ["nptel.ac.in", "swayam.gov.in"],
        "verify_domains": ["nptel.ac.in", "swayam.gov.in"],
        "verify_path": "/LocalChapterAndTarget/pdf/certifyportal",
        "marks_by_level": {
            "completed": 3,
            "elite": 5,
            "elite+silver": 10,
            "silver": 10,
            "elite+gold": 15,
            "gold": 15,
        },
        "aliases": ["swayam", "nptel online course", "nptel certification"],
        "requires_marksheet": True,
        "requires_exam_centre": True,
    },

    # ── AWS ──────────────────────────────────────────────────────────────
    "aws certified cloud practitioner": {
        "tier": "Foundation",
        "marks": 5,
        "issuer": "Amazon Web Services",
        "issuer_domains": ["aws.amazon.com", "amazon.com"],
        "verify_domains": ["credly.com", "youracclaim.com", "aws.amazon.com"],
        "aliases": ["clf-c01", "clf-c02", "aws cloud practitioner", "cloud practitioner"],
    },
    "aws certified developer associate": {
        "tier": "Associate",
        "marks": 10,
        "issuer": "Amazon Web Services",
        "issuer_domains": ["aws.amazon.com"],
        "verify_domains": ["credly.com", "youracclaim.com"],
        "aliases": ["dva-c01", "dva-c02", "aws developer associate"],
    },
    "aws certified solutions architect associate": {
        "tier": "Associate",
        "marks": 10,
        "issuer": "Amazon Web Services",
        "issuer_domains": ["aws.amazon.com"],
        "verify_domains": ["credly.com", "youracclaim.com"],
        "aliases": ["saa-c02", "saa-c03", "aws saa", "solutions architect associate"],
    },
    "aws certified sysops administrator associate": {
        "tier": "Associate",
        "marks": 10,
        "issuer": "Amazon Web Services",
        "issuer_domains": ["aws.amazon.com"],
        "verify_domains": ["credly.com", "youracclaim.com"],
        "aliases": ["soa-c02", "aws sysops"],
    },
    "aws certified solutions architect professional": {
        "tier": "Professional",
        "marks": 15,
        "issuer": "Amazon Web Services",
        "issuer_domains": ["aws.amazon.com"],
        "verify_domains": ["credly.com", "youracclaim.com"],
        "aliases": ["sap-c01", "sap-c02", "aws sap", "solutions architect professional"],
    },
    "aws certified devops engineer professional": {
        "tier": "Professional",
        "marks": 15,
        "issuer": "Amazon Web Services",
        "issuer_domains": ["aws.amazon.com"],
        "verify_domains": ["credly.com", "youracclaim.com"],
        "aliases": ["dop-c01", "dop-c02", "aws devops professional"],
    },

    # ── GOOGLE CLOUD ────────────────────────────────────────────────────
    "google associate cloud engineer": {
        "tier": "Associate",
        "marks": 10,
        "issuer": "Google Cloud",
        "issuer_domains": ["cloud.google.com", "google.com"],
        "verify_domains": ["credential.net", "credly.com", "googlecloudskillsboost.google.com"],
        "aliases": ["ace", "gcp associate cloud engineer", "associate cloud engineer"],
    },
    "google professional cloud architect": {
        "tier": "Professional",
        "marks": 15,
        "issuer": "Google Cloud",
        "issuer_domains": ["cloud.google.com"],
        "verify_domains": ["credential.net", "credly.com"],
        "aliases": ["pca", "gcp professional cloud architect", "professional cloud architect"],
    },
    "google professional data engineer": {
        "tier": "Professional",
        "marks": 15,
        "issuer": "Google Cloud",
        "issuer_domains": ["cloud.google.com"],
        "verify_domains": ["credential.net", "credly.com"],
        "aliases": ["gcp pde", "professional data engineer"],
    },
    "google professional cloud developer": {
        "tier": "Professional",
        "marks": 15,
        "issuer": "Google Cloud",
        "issuer_domains": ["cloud.google.com"],
        "verify_domains": ["credential.net", "credly.com"],
        "aliases": ["gcp professional developer"],
    },

    # ── MICROSOFT AZURE ─────────────────────────────────────────────────
    "microsoft azure fundamentals": {
        "tier": "Foundation",
        "marks": 5,
        "issuer": "Microsoft",
        "issuer_domains": ["microsoft.com", "learn.microsoft.com"],
        "verify_domains": ["learn.microsoft.com", "credly.com"],
        "aliases": ["az-900", "az900", "azure fundamentals"],
    },
    "microsoft azure ai fundamentals": {
        "tier": "Foundation",
        "marks": 5,
        "issuer": "Microsoft",
        "issuer_domains": ["microsoft.com"],
        "verify_domains": ["learn.microsoft.com", "credly.com"],
        "aliases": ["ai-900", "ai900", "azure ai fundamentals"],
    },
    "microsoft azure data fundamentals": {
        "tier": "Foundation",
        "marks": 5,
        "issuer": "Microsoft",
        "issuer_domains": ["microsoft.com"],
        "verify_domains": ["learn.microsoft.com", "credly.com"],
        "aliases": ["dp-900", "dp900", "azure data fundamentals"],
    },
    "microsoft azure administrator": {
        "tier": "Associate",
        "marks": 10,
        "issuer": "Microsoft",
        "issuer_domains": ["microsoft.com"],
        "verify_domains": ["learn.microsoft.com", "credly.com"],
        "aliases": ["az-104", "az104", "azure administrator associate"],
    },
    "microsoft azure developer associate": {
        "tier": "Associate",
        "marks": 10,
        "issuer": "Microsoft",
        "issuer_domains": ["microsoft.com"],
        "verify_domains": ["learn.microsoft.com", "credly.com"],
        "aliases": ["az-204", "az204", "azure developer"],
    },
    "microsoft azure solutions architect expert": {
        "tier": "Professional",
        "marks": 15,
        "issuer": "Microsoft",
        "issuer_domains": ["microsoft.com"],
        "verify_domains": ["learn.microsoft.com", "credly.com"],
        "aliases": ["az-305", "az305", "azure solutions architect"],
    },
    "microsoft azure devops engineer expert": {
        "tier": "Professional",
        "marks": 15,
        "issuer": "Microsoft",
        "issuer_domains": ["microsoft.com"],
        "verify_domains": ["learn.microsoft.com", "credly.com"],
        "aliases": ["az-400", "az400", "azure devops engineer"],
    },

    # ── CISCO ───────────────────────────────────────────────────────────
    "cisco certified network associate": {
        "tier": "Associate",
        "marks": 10,
        "issuer": "Cisco",
        "issuer_domains": ["cisco.com"],
        "verify_domains": ["credly.com", "cisco.com"],
        "aliases": ["ccna", "cisco ccna"],
    },
    "cisco certified network professional": {
        "tier": "Professional",
        "marks": 15,
        "issuer": "Cisco",
        "issuer_domains": ["cisco.com"],
        "verify_domains": ["credly.com", "cisco.com"],
        "aliases": ["ccnp", "cisco ccnp"],
    },
    "cisco certified internetwork expert": {
        "tier": "Professional",
        "marks": 15,
        "issuer": "Cisco",
        "issuer_domains": ["cisco.com"],
        "verify_domains": ["credly.com", "cisco.com"],
        "aliases": ["ccie", "cisco ccie"],
    },

    # ── COMPTIA ─────────────────────────────────────────────────────────
    "comptia a+": {
        "tier": "Foundation",
        "marks": 5,
        "issuer": "CompTIA",
        "issuer_domains": ["comptia.org"],
        "verify_domains": ["certmetrics.com", "credly.com", "comptia.org"],
        "aliases": ["comptia a plus", "a+ certification"],
    },
    "comptia network+": {
        "tier": "Foundation",
        "marks": 5,
        "issuer": "CompTIA",
        "issuer_domains": ["comptia.org"],
        "verify_domains": ["certmetrics.com", "credly.com"],
        "aliases": ["comptia network plus", "network+ certification"],
    },
    "comptia security+": {
        "tier": "Associate",
        "marks": 10,
        "issuer": "CompTIA",
        "issuer_domains": ["comptia.org"],
        "verify_domains": ["certmetrics.com", "credly.com"],
        "aliases": ["comptia security plus", "security+ certification", "sy0-601", "sy0-701"],
    },
    "comptia cysa+": {
        "tier": "Professional",
        "marks": 15,
        "issuer": "CompTIA",
        "issuer_domains": ["comptia.org"],
        "verify_domains": ["certmetrics.com", "credly.com"],
        "aliases": ["comptia cybersecurity analyst", "cysa plus"],
    },
    "comptia pentest+": {
        "tier": "Professional",
        "marks": 15,
        "issuer": "CompTIA",
        "issuer_domains": ["comptia.org"],
        "verify_domains": ["certmetrics.com", "credly.com"],
        "aliases": ["comptia pentest plus"],
    },

    # ── ORACLE ──────────────────────────────────────────────────────────
    "oracle certified associate": {
        "tier": "Associate",
        "marks": 10,
        "issuer": "Oracle",
        "issuer_domains": ["oracle.com"],
        "verify_domains": ["catalog.oracle.com", "credly.com"],
        "aliases": ["oca", "oracle oca"],
    },
    "oracle certified professional": {
        "tier": "Professional",
        "marks": 15,
        "issuer": "Oracle",
        "issuer_domains": ["oracle.com"],
        "verify_domains": ["catalog.oracle.com", "credly.com"],
        "aliases": ["ocp", "oracle ocp"],
    },
    "oracle cloud infrastructure foundations associate": {
        "tier": "Foundation",
        "marks": 5,
        "issuer": "Oracle",
        "issuer_domains": ["oracle.com"],
        "verify_domains": ["catalog.oracle.com", "credly.com"],
        "aliases": ["oci foundations", "oracle oci foundations"],
    },

    # ── RED HAT ─────────────────────────────────────────────────────────
    "red hat certified system administrator": {
        "tier": "Associate",
        "marks": 10,
        "issuer": "Red Hat",
        "issuer_domains": ["redhat.com"],
        "verify_domains": ["rhtapps.redhat.com", "credly.com"],
        "aliases": ["rhcsa", "red hat rhcsa"],
    },
    "red hat certified engineer": {
        "tier": "Professional",
        "marks": 15,
        "issuer": "Red Hat",
        "issuer_domains": ["redhat.com"],
        "verify_domains": ["rhtapps.redhat.com", "credly.com"],
        "aliases": ["rhce", "red hat rhce"],
    },

    # ── PALO ALTO / CYBERSECURITY ───────────────────────────────────────
    "palo alto networks certified cybersecurity associate": {
        "tier": "Foundation",
        "marks": 5,
        "issuer": "Palo Alto Networks",
        "issuer_domains": ["paloaltonetworks.com"],
        "verify_domains": ["credly.com"],
        "aliases": ["pccsa", "palo alto pccsa"],
    },
    "certified ethical hacker": {
        "tier": "Associate",
        "marks": 10,
        "issuer": "EC-Council",
        "issuer_domains": ["eccouncil.org"],
        "verify_domains": ["aspen.eccouncil.org", "credly.com"],
        "aliases": ["ceh", "ec-council ceh"],
    },
    "certified information systems security professional": {
        "tier": "Professional",
        "marks": 15,
        "issuer": "ISC2",
        "issuer_domains": ["isc2.org"],
        "verify_domains": ["isc2.org", "credly.com"],
        "aliases": ["cissp", "isc2 cissp"],
    },
}

# Domains that are recognized as safe verification partners
SAFE_VERIFY_DOMAINS = {
    "credly.com", "youracclaim.com", "badgr.com", "credential.net",
    "certmetrics.com", "acclaim.com",
    "aws.amazon.com", "amazon.com",
    "cloud.google.com", "googlecloudskillsboost.google.com", "google.com",
    "learn.microsoft.com", "microsoft.com",
    "cisco.com", "comptia.org", "oracle.com", "catalog.oracle.com",
    "redhat.com", "rhtapps.redhat.com",
    "eccouncil.org", "aspen.eccouncil.org",
    "isc2.org", "paloaltonetworks.com",
    "nptel.ac.in", "archive.nptel.ac.in", "swayam.gov.in",
    "certiport.com", "pearsonvue.com", "prometric.com",
}

# Domains that are NEVER safe regardless of context
BLOCKLISTED_DOMAINS = {
    "bit.ly", "tinyurl.com", "t.co", "short.link",
    "goo.gl", "ow.ly", "buff.ly", "rebrand.ly",
}

# NOT eligible — course completion only, not qualifying exams
INELIGIBLE_PLATFORMS = {
    "udemy.com", "coursera.org", "linkedin.com", "infosys.com",
    "simplilearn.com", "edx.org", "pluralsight.com", "skillshare.com",
    "springboard.com", "udacity.com", "alison.com",
}
