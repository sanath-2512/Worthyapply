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
    _s("unit testing", ["unit testing", "unit tests"], parents=["testing"], tier="concept"),
    # ---- more languages / runtimes
    _s("dart", ["Dart"]),
    _s("flutter", ["Flutter"], parents=["dart", "mobile"]),
    _s("matlab", ["MATLAB"]),
    _s("bash", ["Bash", "shell scripting"], parents=["linux"], case_sensitive=["Shell"]),
    _s("powershell", ["PowerShell"]),
    _s("perl", ["Perl"]),
    _s("elixir", ["Elixir"]),
    _s("haskell", ["Haskell"]),
    _s("r language", ["RStudio", "R programming", "R language"]),
    _s(".net", [".NET", "dotnet", ".NET Core"], parents=["c#"]),
    _s("asp.net", ["ASP.NET"], parents=[".net", "backend"]),
    _s("laravel", ["Laravel"], parents=["php", "backend"]),
    _s("nestjs", ["NestJS", "Nest.js"], parents=["node.js", "typescript", "backend"]),
    _s("svelte", ["Svelte", "SvelteKit"], parents=["frontend"]),
    _s("jquery", ["jQuery"], parents=["javascript", "frontend"]),
    _s("bootstrap", ["Bootstrap"], parents=["css"]),
    _s("material ui", ["Material UI", "MUI"], parents=["react"]),
    _s("vite", ["Vite"], parents=["frontend"]),
    _s("webpack", ["Webpack"], parents=["frontend"]),
    _s("three.js", ["Three.js", "ThreeJS"], parents=["javascript", "frontend"]),
    _s("storybook", ["Storybook"], parents=["frontend"]),
    # ---- more data / BI
    _s("snowflake", ["Snowflake"], parents=["sql", "data warehousing"]),
    _s("databricks", ["Databricks"], parents=["spark", "big data"]),
    _s("airflow", ["Airflow", "Apache Airflow"], parents=["data pipelines"]),
    _s("dbt", ["dbt"], parents=["sql", "data pipelines"]),
    _s("tableau", ["Tableau"], parents=["data visualization"]),
    _s("power bi", ["Power BI", "PowerBI"], parents=["data visualization"]),
    _s("looker", ["Looker"], parents=["data visualization"]),
    _s("excel", ["Excel", "Microsoft Excel"]),
    _s("numpy", ["NumPy"], parents=["python"]),
    _s("matplotlib", ["Matplotlib", "Seaborn"], parents=["python", "data visualization"]),
    _s("etl", ["ETL", "ELT"], parents=["data pipelines"], tier="concept"),
    _s("data pipelines", ["data pipeline", "data pipelines"], tier="concept"),
    _s("data warehousing", ["data warehouse", "data warehousing"], tier="concept"),
    _s("data visualization", ["data visualization", "dashboards", "dashboard"], tier="concept"),
    _s("cassandra", ["Cassandra"], parents=["nosql", "databases"]),
    _s("neo4j", ["Neo4j"], parents=["databases"]),
    _s("oracle db", ["Oracle Database", "Oracle DB", "PL/SQL"], parents=["sql", "databases"]),
    _s("firebase", ["Firebase", "Firestore"], parents=["gcp", "databases"]),
    _s("supabase", ["Supabase"], parents=["postgresql"]),
    # ---- more ML / AI
    _s("keras", ["Keras"], parents=["deep learning"]),
    _s("hugging face", ["Hugging Face", "HuggingFace", "Transformers library"], parents=["nlp", "machine learning"]),
    _s("openai api", ["OpenAI API", "OpenAI", "GPT-4", "GPT-3.5", "ChatGPT API"], parents=["llms"]),
    _s("xgboost", ["XGBoost", "LightGBM"], parents=["machine learning"]),
    _s("mlflow", ["MLflow"], parents=["mlops"]),
    _s("kubeflow", ["Kubeflow"], parents=["mlops", "kubernetes"]),
    _s("mlops", ["MLOps"], tier="concept"),
    _s("nlp", ["NLP", "natural language processing"], parents=["machine learning"], tier="concept"),
    _s("computer vision", ["computer vision", "OpenCV"], parents=["machine learning"], tier="concept"),
    # ---- more cloud / infra / tooling
    _s("aws sqs", ["SQS", "Amazon SQS", "AWS SQS"], parents=["aws", "message queues"]),
    _s("aws sns", ["SNS", "Amazon SNS", "AWS SNS"], parents=["aws"]),
    _s("aws cloudformation", ["CloudFormation"], parents=["aws", "infrastructure as code"]),
    _s("aws rds", ["Amazon RDS", "AWS RDS"], parents=["aws", "sql", "databases"], case_sensitive=["RDS"]),
    _s("aws api gateway", ["API Gateway"], parents=["aws", "apis"]),
    _s("gke", ["GKE", "Google Kubernetes Engine"], parents=["gcp", "kubernetes"]),
    _s("cloud run", ["Cloud Run"], parents=["gcp", "containers"]),
    _s("cloud functions", ["Cloud Functions"], parents=["gcp", "serverless"]),
    _s("aks", ["AKS", "Azure Kubernetes Service"], parents=["azure", "kubernetes"]),
    _s("azure functions", ["Azure Functions"], parents=["azure", "serverless"]),
    _s("vercel", ["Vercel"], parents=["cloud"]),
    _s("netlify", ["Netlify"], parents=["cloud"]),
    _s("heroku", ["Heroku"], parents=["cloud"]),
    _s("ansible", ["Ansible"], parents=["infrastructure as code"]),
    _s("helm", ["Helm"], parents=["kubernetes"]),
    _s("prometheus", ["Prometheus"], parents=["monitoring"]),
    _s("grafana", ["Grafana"], parents=["monitoring"]),
    _s("datadog", ["Datadog"], parents=["monitoring"]),
    _s("elk", ["ELK", "Logstash", "Kibana"], parents=["monitoring", "elasticsearch"]),
    _s("monitoring", ["monitoring", "observability"], tier="concept"),
    _s("nginx", ["Nginx", "NGINX"], parents=["linux"]),
    _s("postman", ["Postman"], parents=["apis"]),
    _s("jira", ["Jira"], parents=["agile"]),
    _s("figma", ["Figma"], parents=["ui design"]),
    _s("ui design", ["UI design", "UX design", "UI/UX"], tier="concept"),
    _s("agile", ["Agile", "Scrum", "Kanban"], tier="concept"),
    _s("oauth", ["OAuth", "OAuth2", "JWT", "OpenID Connect"], parents=["security"]),
    _s("security", ["application security", "web security", "cybersecurity"], tier="concept"),
    # ---- more testing
    _s("cypress", ["Cypress"], parents=["testing"]),
    _s("playwright", ["Playwright"], parents=["testing"]),
    _s("selenium", ["Selenium"], parents=["testing"]),
    _s("junit", ["JUnit"], parents=["unit testing", "java"]),
    _s("mocha", ["Mocha", "Chai"], parents=["unit testing", "javascript"]),
    _s("react testing library", ["React Testing Library", "RTL"], parents=["unit testing", "react"]),
    _s("testing", ["end-to-end testing", "e2e testing", "test automation", "automated testing"],
       tier="concept"),
    # ---- broader coverage (common in JDs; each maps into the hierarchy above)
    _s("nomad", ["HashiCorp Nomad"], parents=["container orchestration"], case_sensitive=["Nomad"]),
    _s("openshift", ["OpenShift"], parents=["container orchestration"]),
    _s("istio", ["Istio", "service mesh"], parents=["kubernetes"]),
    _s("argo cd", ["Argo CD", "ArgoCD", "Argo Workflows"], parents=["ci/cd", "kubernetes"]),
    _s("pulumi", ["Pulumi"], parents=["infrastructure as code"]),
    _s("circleci", ["CircleCI"], parents=["ci/cd"]),
    _s("azure devops", ["Azure DevOps", "Azure Pipelines"], parents=["ci/cd", "azure"]),
    _s("aws kinesis", ["Kinesis", "AWS Kinesis"], parents=["aws", "event streaming"]),
    _s("aws glue", ["AWS Glue"], parents=["aws", "etl"]),
    _s("aws redshift", ["Redshift", "AWS Redshift"], parents=["aws", "data warehousing"]),
    _s("aws athena", ["Athena", "AWS Athena"], parents=["aws"]),
    _s("aws cloudwatch", ["CloudWatch"], parents=["aws", "monitoring"]),
    _s("aws iam", ["AWS IAM"], parents=["aws", "security"]),
    _s("flink", ["Apache Flink", "Flink"], parents=["event streaming", "big data"]),
    _s("apache beam", ["Apache Beam"], parents=["data pipelines"]),
    _s("sentry", ["Sentry"], parents=["monitoring"]),
    _s("new relic", ["New Relic"], parents=["monitoring"]),
    _s("splunk", ["Splunk"], parents=["monitoring"]),
    _s("opentelemetry", ["OpenTelemetry", "OTel"], parents=["monitoring"]),
    _s("langgraph", ["LangGraph"], parents=["langchain"]),
    _s("ollama", ["Ollama"], parents=["llms"]),
    _s("spacy", ["spaCy"], parents=["nlp", "python"]),
    _s("nltk", ["NLTK"], parents=["nlp", "python"]),
    _s("jupyter", ["Jupyter", "Jupyter Notebook", "JupyterLab"], parents=["python"]),
    _s("plotly", ["Plotly"], parents=["data visualization"]),
    _s("streamlit", ["Streamlit"], parents=["python", "frontend"]),
    _s("gradio", ["Gradio"], parents=["python"]),
    _s("celery", ["Celery"], parents=["message queues", "python"]),
    _s("sqlalchemy", ["SQLAlchemy"], parents=["sql", "python"]),
    _s("prisma", ["Prisma"], parents=["databases", "typescript"]),
    _s("hibernate", ["Hibernate", "JPA"], parents=["java", "sql"]),
    _s("entity framework", ["Entity Framework", "EF Core"], parents=[".net", "sql"]),
    _s("mongoose", ["Mongoose"], parents=["mongodb", "node.js"]),
    _s("websockets", ["WebSocket", "WebSockets", "Socket.IO"], parents=["backend"]),
    _s("webrtc", ["WebRTC"], parents=["frontend"]),
    _s("trpc", ["tRPC"], parents=["apis", "typescript"]),
    _s("fastify", ["Fastify"], parents=["node.js", "rest apis"]),
    _s("nuxt", ["Nuxt", "Nuxt.js"], parents=["vue.js"]),
    _s("remix", ["Remix.run"], parents=["react"], case_sensitive=["Remix"]),
    _s("gatsby", ["Gatsby", "Gatsby.js"], parents=["react"]),
    _s("sass", ["Sass", "SCSS"], parents=["css"]),
    _s("electron", ["Electron.js", "ElectronJS"], parents=["javascript"], case_sensitive=["Electron"]),
    _s("ionic", ["Ionic"], parents=["mobile"]),
    _s("xamarin", ["Xamarin"], parents=["mobile", "c#"]),
    _s("swiftui", ["SwiftUI"], parents=["swift", "mobile"]),
    _s("jetpack compose", ["Jetpack Compose"], parents=["kotlin", "mobile"]),
    _s("objective-c", ["Objective-C"], parents=["mobile"]),
    _s("unity", ["Unity3D", "Unity 3D"], case_sensitive=["Unity"]),
    _s("webassembly", ["WebAssembly", "WASM"], parents=["frontend"]),
    _s("solidity", ["Solidity"]),
    _s("vitest", ["Vitest"], parents=["unit testing", "javascript"]),
    _s("jmeter", ["JMeter", "k6", "Locust"], parents=["testing"]),
    _s("cucumber", ["Cucumber", "Gherkin"], parents=["testing"]),
    _s("auth0", ["Auth0", "Keycloak", "Okta"], parents=["oauth"]),
    _s("stripe", ["Stripe API"], parents=["apis"], case_sensitive=["Stripe"]),
    _s("gitlab", ["GitLab", "GitHub", "Bitbucket"], parents=["git"]),
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
