"""
Skill normalization + a small skill hierarchy (ESCO-style broader/narrower links).

Why this exists: the LLM is good at reading context but inconsistent on two things
that are cheap to get right deterministically:

  1. Aliases       — "Postgres" is PostgreSQL, "K8s" is Kubernetes.
  2. Specificity   — a SPECIFIC technology is evidence for its BROADER family
                     (AWS Bedrock / S3 prove "AWS"; FastAPI proves "REST APIs"),
                     but never the reverse ("AWS" does not prove "AWS Lambda").

The lexicon is deliberately small and curated — the common stacks this product
sees — rather than a full taxonomy download. Unknown terms simply fall back to the
LLM's judgement; nothing here ever *removes* evidence for a term it doesn't know.

Matching is word-boundary aware and case-insensitive, except for a few ambiguous
short names (e.g. "Go") that are matched case-sensitively.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache


@dataclass(frozen=True)
class Skill:
    key: str
    labels: tuple[str, ...]          # surface forms (first = display label)
    parents: tuple[str, ...] = ()    # broader skills this one is evidence for
    # "tool": a concrete, nameable technology — its absence from the resume is
    #         decisive, so a model claim of a match without it is overruled.
    # "concept": a practice/field ("machine learning", "REST APIs") that can be
    #         evidenced in prose without the literal words, so the LLM decides.
    tier: str = "tool"
    case_sensitive: tuple[str, ...] = field(default=())


def _s(key, labels, parents=(), tier="tool", case_sensitive=()):
    return Skill(key, tuple(labels), tuple(parents), tier, tuple(case_sensitive))


_SKILLS: list[Skill] = [
    # ---- languages
    _s("python", ["Python"]),
    _s("javascript", ["JavaScript", "ECMAScript"], case_sensitive=["JS"]),
    _s("typescript", ["TypeScript"], parents=["javascript"], case_sensitive=["TS"]),
    _s("java", ["Java"]),
    _s("go", ["Golang"], case_sensitive=["Go"]),
    _s("rust", [], case_sensitive=["Rust"]),
    _s("c++", ["C++", "CPP"]),
    _s("c#", ["C#", "C Sharp"]),
    _s("scala", ["Scala"]),
    _s("kotlin", ["Kotlin"]),
    _s("swift", [], case_sensitive=["Swift"]),
    _s("ruby", ["Ruby on Rails"], case_sensitive=["Ruby"]),
    _s("php", ["PHP"]),
    _s("sql", ["SQL"], tier="concept"),
    # ---- web / backend
    _s("rest apis", ["REST APIs", "REST API", "RESTful APIs", "RESTful"], parents=["apis"], tier="concept", case_sensitive=["REST"]),
    _s("apis", ["APIs", "API"], tier="concept"),
    _s("graphql", ["GraphQL"], parents=["apis"]),
    _s("grpc", ["gRPC"], parents=["apis"]),
    _s("fastapi", ["FastAPI"], parents=["python", "rest apis", "backend"]),
    _s("django", ["Django"], parents=["python", "rest apis", "backend"]),
    _s("flask", ["Flask"], parents=["python", "rest apis", "backend"]),
    _s("node.js", ["Node.js", "NodeJS"], parents=["javascript", "backend"], case_sensitive=["Node"]),
    _s("express", ["Express.js", "ExpressJS"], parents=["node.js", "rest apis", "backend"], case_sensitive=["Express"]),
    _s("spring boot", ["Spring Boot"], parents=["java", "rest apis", "backend"], case_sensitive=["Spring"]),
    _s("backend", ["backend", "back-end", "server-side"], tier="concept"),
    _s("microservices", ["microservices", "microservice"], tier="concept"),
    # ---- frontend
    _s("react", ["React", "React.js", "ReactJS"], parents=["frontend"]),
    _s("react native", ["React Native"], parents=["mobile"]),
    _s("next.js", ["Next.js", "NextJS"], parents=["react", "frontend"]),
    _s("vue.js", ["Vue.js", "Vue", "VueJS"], parents=["frontend"]),
    _s("angular", ["Angular"], parents=["frontend"]),
    _s("redux", ["Redux"], parents=["react"]),
    _s("html", ["HTML", "HTML5"], parents=["frontend"]),
    _s("css", ["CSS", "CSS3"], parents=["frontend"]),
    _s("tailwind", ["Tailwind CSS", "Tailwind"], parents=["css"]),
    _s("frontend", ["frontend", "front-end"], tier="concept"),
    _s("mobile", ["mobile development", "mobile app", "mobile apps"], tier="concept", case_sensitive=["iOS", "Android"]),
    # ---- data stores
    _s("postgresql", ["PostgreSQL", "Postgres"], parents=["sql", "databases"]),
    _s("mysql", ["MySQL"], parents=["sql", "databases"]),
    _s("sqlite", ["SQLite"], parents=["sql", "databases"]),
    _s("sql server", ["SQL Server", "MSSQL"], parents=["sql", "databases"]),
    _s("mongodb", ["MongoDB", "Mongo"], parents=["nosql", "databases"]),
    _s("redis", ["Redis"], parents=["nosql", "databases"]),
    _s("dynamodb", ["DynamoDB"], parents=["aws", "nosql", "databases"]),
    _s("elasticsearch", ["Elasticsearch", "Elastic Search"], parents=["search"]),
    _s("opensearch", ["OpenSearch"], parents=["search"]),
    _s("nosql", ["NoSQL"], tier="concept"),
    _s("databases", ["databases", "database"], tier="concept"),
    _s("search", ["search engine", "full-text search"], tier="concept"),
    # ---- cloud (children prove the parent platform, never the reverse)
    _s("aws", ["AWS", "Amazon Web Services"], parents=["cloud"]),
    _s("aws bedrock", ["AWS Bedrock", "Amazon Bedrock"], parents=["aws", "generative ai"], case_sensitive=["Bedrock"]),
    _s("aws lambda", ["AWS Lambda", "Lambda functions"], parents=["aws", "serverless"]),
    _s("aws s3", ["S3", "Amazon S3", "AWS S3"], parents=["aws"]),
    _s("aws ec2", ["EC2", "Amazon EC2", "AWS EC2"], parents=["aws"]),
    _s("aws ecs", ["Amazon ECS", "AWS ECS", "Fargate"], parents=["aws", "containers"], case_sensitive=["ECS"]),
    _s("aws eks", ["Amazon EKS", "AWS EKS"], parents=["aws", "kubernetes"], case_sensitive=["EKS"]),
    _s("aws sagemaker", ["SageMaker", "AWS SageMaker", "Amazon SageMaker"], parents=["aws", "machine learning"]),
    _s("gcp", ["GCP", "Google Cloud", "Google Cloud Platform"], parents=["cloud"]),
    _s("bigquery", ["BigQuery"], parents=["gcp", "sql"]),
    _s("azure", ["Azure", "Microsoft Azure"], parents=["cloud"]),
    _s("cloud", ["cloud computing", "cloud platforms", "cloud"], tier="concept"),
    _s("serverless", ["serverless"], tier="concept"),
    # ---- devops
    _s("docker", ["Docker"], parents=["containers"]),
    _s("kubernetes", ["Kubernetes", "K8s"], parents=["containers", "container orchestration"]),
    _s("containers", ["containers", "containerization", "containerized"], tier="concept"),
    _s("container orchestration", ["container orchestration"], tier="concept"),
    _s("terraform", ["Terraform"], parents=["infrastructure as code"]),
    _s("infrastructure as code", ["infrastructure as code"], tier="concept", case_sensitive=["IaC"]),
    _s("github actions", ["GitHub Actions"], parents=["ci/cd"]),
    _s("jenkins", ["Jenkins"], parents=["ci/cd"]),
    _s("gitlab ci", ["GitLab CI"], parents=["ci/cd"]),
    _s("ci/cd", ["CI/CD", "CI / CD", "continuous integration", "continuous delivery"], tier="concept"),
    _s("git", ["Git"]),
    _s("linux", ["Linux"]),
    _s("kafka", ["Kafka", "Apache Kafka"], parents=["event streaming"]),
    _s("rabbitmq", ["RabbitMQ"], parents=["message queues"]),
    _s("event streaming", ["event streaming", "stream processing"], tier="concept"),
    _s("message queues", ["message queues", "message queue"], tier="concept"),
    _s("spark", ["Apache Spark", "PySpark"], parents=["big data"], case_sensitive=["Spark"]),
    _s("hadoop", ["Hadoop"], parents=["big data"]),
    _s("big data", ["big data"], tier="concept"),
    # ---- ML / AI
    _s("pytorch", ["PyTorch"], parents=["deep learning", "machine learning", "python"]),
    _s("tensorflow", ["TensorFlow"], parents=["deep learning", "machine learning"]),
    _s("scikit-learn", ["scikit-learn", "sklearn"], parents=["machine learning", "python"]),
    _s("pandas", ["pandas"], parents=["python", "data analysis"]),
    _s("deep learning", ["deep learning"], parents=["machine learning"], tier="concept"),
    _s("machine learning", ["machine learning"], tier="concept", case_sensitive=["ML"]),
    _s("data analysis", ["data analysis"], tier="concept"),
    _s("langchain", ["LangChain"], parents=["llms", "generative ai"]),
    _s("llamaindex", ["LlamaIndex"], parents=["llms", "rag"]),
    _s("llms", ["LLMs", "LLM", "large language models"], parents=["generative ai"], tier="concept"),
    _s("rag", ["RAG", "retrieval-augmented generation", "retrieval augmented generation"],
       parents=["llms", "generative ai"], tier="concept"),
    _s("generative ai", ["generative AI", "GenAI", "Gen AI"], tier="concept"),
    _s("vector databases", ["vector database", "vector databases", "vector store", "Pinecone", "FAISS",
                            "Weaviate", "pgvector", "ChromaDB"], parents=["rag"]),
    # ---- testing
    _s("pytest", ["pytest"], parents=["unit testing", "python"]),
    _s("jest", ["Jest"], parents=["unit testing", "javascript"]),
    _s("unit testing", ["unit testing", "unit tests"], tier="concept"),
    # ---- certifications (never proven by using the technology)
    _s("aws certified", ["AWS Certified", "AWS Certification"], tier="tool"),
]

SKILLS: dict[str, Skill] = {s.key: s for s in _SKILLS}


def _pattern(label: str) -> str:
    # Word boundaries that also work for labels ending in symbols (C++, C#, .js).
    return r"(?<![A-Za-z0-9_])" + re.escape(label) + r"(?![A-Za-z0-9_+#])"


@lru_cache(maxsize=1)
def _compiled() -> list[tuple[str, re.Pattern]]:
    out: list[tuple[str, re.Pattern]] = []
    for s in _SKILLS:
        for label in s.labels:
            out.append((s.key, re.compile(_pattern(label), re.IGNORECASE)))
        for label in s.case_sensitive:
            out.append((s.key, re.compile(_pattern(label))))
    return out


def find_skills(text: str) -> set[str]:
    """Canonical keys of every lexicon skill mentioned in `text`.

    A longer label wins over a shorter one it contains ("React Native" is not also
    "React"; "JavaScript" is not also "Java") by masking matched spans.
    """
    if not text:
        return set()
    found: set[str] = set()
    hits: list[tuple[int, int, str]] = []
    for key, pat in _compiled():
        for m in pat.finditer(text):
            hits.append((m.start(), m.end(), key))
    # Longest spans first; skip any span overlapping an already-claimed one.
    hits.sort(key=lambda h: (-(h[1] - h[0]), h[0]))
    taken: list[tuple[int, int]] = []
    for a, b, key in hits:
        if any(a < tb and ta < b for ta, tb in taken):
            continue
        taken.append((a, b))
        found.add(key)
    return found


def canonical(term: str) -> str | None:
    """Canonical key if `term` is (or names exactly) a lexicon skill, else None."""
    t = (term or "").strip()
    if not t:
        return None
    for key, pat in _compiled():
        if pat.fullmatch(t):
            return key
    keys = find_skills(t)
    # Accept a single dominant skill in short phrases like "Python programming".
    if len(keys) == 1 and len(t.split()) <= 3:
        return next(iter(keys))
    return None


def ancestors(key: str) -> set[str]:
    """All broader skills `key` is evidence for (transitively)."""
    seen: set[str] = set()
    stack = list(SKILLS[key].parents) if key in SKILLS else []
    while stack:
        p = stack.pop()
        if p in seen or p not in SKILLS:
            continue
        seen.add(p)
        stack.extend(SKILLS[p].parents)
    return seen


def evidenced(text: str) -> dict[str, str]:
    """Map every skill evidenced by `text` → how: 'direct' or 'related:<child>'.

    Direct mentions win; a broader skill reachable only through a more specific
    one is recorded as related, naming the specific skill that proves it.
    """
    direct = find_skills(text)
    out: dict[str, str] = {k: "direct" for k in direct}
    for k in sorted(direct):
        for anc in ancestors(k):
            out.setdefault(anc, f"related:{k}")
    return out


def support_for(term: str, text: str) -> str | None:
    """How `text` supports the requirement `term`: 'direct', 'related:<child>',
    or None when it doesn't (or the term isn't in the lexicon)."""
    key = canonical(term)
    if key is None:
        return None
    return evidenced(text).get(key)


def is_tool(term: str) -> bool:
    key = canonical(term)
    return key is not None and SKILLS[key].tier == "tool"


def label(key: str) -> str:
    s = SKILLS.get(key)
    if s is None:
        return key
    return (s.labels or s.case_sensitive or (key,))[0]
