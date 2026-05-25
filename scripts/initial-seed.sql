--
-- PostgreSQL database dump
--

\restrict oN7JjS0R4EySANenKpZk9YXxxXkzXsP15eRKBRuF4jFse8g8XSJ8db89XmFoMvm

-- Dumped from database version 17.10 (322a063)
-- Dumped by pg_dump version 18.4

-- Started on 2026-05-25 00:51:50

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5 (class 2615 OID 65536)
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- TOC entry 3589 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- TOC entry 891 (class 1247 OID 65740)
-- Name: AiAnalysisKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AiAnalysisKind" AS ENUM (
    'OCR_EXTRACTION',
    'EXECUTIVE_SUMMARY',
    'ASSIGNMENT_SUGGESTION',
    'EXTERNAL_AVIS_SUMMARY',
    'CLASSIFICATION'
);


--
-- TOC entry 882 (class 1247 OID 65694)
-- Name: AssignmentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AssignmentStatus" AS ENUM (
    'ACTIVE',
    'COMPLETED',
    'RETURNED',
    'SUPERSEDED'
);


--
-- TOC entry 888 (class 1247 OID 65726)
-- Name: AttachmentKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AttachmentKind" AS ENUM (
    'NOTE_INTERNAL',
    'AVIS',
    'DECISION_DRAFT',
    'EXTERNAL_AVIS',
    'RESPONSE_DRAFT',
    'OTHER'
);


--
-- TOC entry 870 (class 1247 OID 65634)
-- Name: DocumentNature; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DocumentNature" AS ENUM (
    'AGREMENT_REQUEST',
    'GENERAL_CORRESPONDENCE',
    'OFFICIAL_NOTIFICATION',
    'PARTNERSHIP_PROPOSAL',
    'COMPLAINT',
    'REPORT',
    'OTHER'
);


--
-- TOC entry 873 (class 1247 OID 65650)
-- Name: DocumentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DocumentStatus" AS ENUM (
    'RECEIVED',
    'AWAITING_DG_ANALYSIS',
    'ASSIGNED',
    'IN_TREATMENT',
    'AWAITING_EXTERNAL_AVIS',
    'AWAITING_DG_DECISION',
    'DECIDED',
    'RESPONSE_SENT',
    'CLOSED',
    'AWAITING_FOLLOW_UP'
);


--
-- TOC entry 879 (class 1247 OID 65680)
-- Name: DocumentVersionKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DocumentVersionKind" AS ENUM (
    'ORIGINAL',
    'SCANNED',
    'COMPLEMENT',
    'RESPONSE_DRAFT',
    'RESPONSE_FINAL',
    'EXTERNAL_AVIS'
);


--
-- TOC entry 897 (class 1247 OID 65774)
-- Name: ExternalRecipient; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ExternalRecipient" AS ENUM (
    'MINISTRE_FINANCES',
    'MINISTRE_INDUSTRIE',
    'DGI',
    'DGD',
    'MINISTRE_AUTRE',
    'ADMINISTRATION_AUTRE'
);


--
-- TOC entry 900 (class 1247 OID 65788)
-- Name: ExternalTransmissionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ExternalTransmissionStatus" AS ENUM (
    'PENDING',
    'RESPONSE_RECEIVED',
    'CANCELLED'
);


--
-- TOC entry 885 (class 1247 OID 65704)
-- Name: HandoffType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."HandoffType" AS ENUM (
    'COURRIER_TO_DG',
    'DG_DISPATCH',
    'VERTICAL_DOWN',
    'HORIZONTAL',
    'RETURN_UP',
    'RETURN_TO_DG',
    'EXTERNAL_OUT',
    'EXTERNAL_IN',
    'DG_TO_COURRIER',
    'RESPONSE_OUT'
);


--
-- TOC entry 894 (class 1247 OID 65752)
-- Name: NotificationKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationKind" AS ENUM (
    'DOCUMENT_RECEIVED',
    'DOCUMENT_ASSIGNED',
    'DOCUMENT_RETURNED_UP',
    'DOCUMENT_HORIZONTAL',
    'DOCUMENT_TO_DG',
    'DG_DECISION_MADE',
    'EXTERNAL_AVIS_RECEIVED',
    'RESPONSE_SENT',
    'ACK_SENT',
    'COMMENT_ADDED'
);


--
-- TOC entry 876 (class 1247 OID 65672)
-- Name: SourceChannel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SourceChannel" AS ENUM (
    'ONLINE',
    'COURRIER_PHYSICAL',
    'ANTENNE'
);


--
-- TOC entry 864 (class 1247 OID 65544)
-- Name: StaffRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StaffRole" AS ENUM (
    'DG',
    'DGA',
    'ATTACHE',
    'AUDITEUR_INTERNE',
    'CHEF_SOUSDIR_COMM',
    'CHEF_SERVICE_COMM',
    'CHEF_SERVICE_RP',
    'CHEF_CELL_TRAD',
    'CHEF_SOUSDIR_AG',
    'CHEF_SERVICE_SAF',
    'CHEF_SERVICE_RH',
    'CHEF_SERVICE_INFO',
    'CHEF_SERVICE_MATERIEL',
    'CHEF_SERVICE_JUR',
    'CHEF_SERVICE_COURRIER',
    'CHEF_BUREAU_ARRIVEE',
    'CHEF_BUREAU_DEPART',
    'CHEF_BUREAU_ARCHIVES',
    'DIR_PROMOTION',
    'CHEF_SOUSDIR_LOCALE',
    'CHEF_SERVICE_PRIMAIRE',
    'CHEF_SERVICE_SECONDAIRE',
    'CHEF_SERVICE_TERTIAIRE',
    'CHEF_SOUSDIR_ETRANGER',
    'CHEF_SERVICE_EUROPE',
    'CHEF_SERVICE_AMERIQUE',
    'CHEF_SERVICE_MOAP',
    'CHEF_SERVICE_AFRIQUE',
    'DIR_FACILITATION',
    'CHEF_SOUSDIR_FACILITATION',
    'CHEF_SERVICE_ACCUEIL',
    'CHEF_SERVICE_AGREMENTS',
    'CHEF_SOUSDIR_COOPERATION',
    'CHEF_SERVICE_BILATERALE',
    'CHEF_SERVICE_MULTILATERALE',
    'CHEF_DIV_SUIVI',
    'CHEF_CELL_SUIVI_EVAL',
    'CHEF_CELL_STRATEGIE',
    'CHEF_ANTENNE',
    'ADMIN'
);


--
-- TOC entry 867 (class 1247 OID 65626)
-- Name: UserStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserStatus" AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'CLOSED'
);


--
-- TOC entry 861 (class 1247 OID 65538)
-- Name: UserType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserType" AS ENUM (
    'STAFF',
    'EXTERNAL'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 218 (class 1259 OID 65806)
-- Name: Account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text
);


--
-- TOC entry 229 (class 1259 OID 65895)
-- Name: AiAnalysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AiAnalysis" (
    id text NOT NULL,
    "documentId" text NOT NULL,
    kind public."AiAnalysisKind" NOT NULL,
    summary text NOT NULL,
    "contentJson" jsonb,
    "modelName" text,
    "tokensIn" integer,
    "tokensOut" integer,
    "generatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 221 (class 1259 OID 65825)
-- Name: Antenne; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Antenne" (
    id text NOT NULL,
    name text NOT NULL,
    region text NOT NULL,
    ville text,
    address text,
    "chefUserId" text,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 225 (class 1259 OID 65861)
-- Name: Assignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Assignment" (
    id text NOT NULL,
    "documentId" text NOT NULL,
    "assignedToRole" public."StaffRole" NOT NULL,
    "assignedToUserId" text,
    "assignedByUserId" text,
    "assignedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    instructions text,
    status public."AssignmentStatus" DEFAULT 'ACTIVE'::public."AssignmentStatus" NOT NULL,
    "completedAt" timestamp(3) without time zone
);


--
-- TOC entry 228 (class 1259 OID 65886)
-- Name: Attachment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Attachment" (
    id text NOT NULL,
    "documentId" text NOT NULL,
    "fileName" text NOT NULL,
    "storageUri" text NOT NULL,
    sha256 text NOT NULL,
    "sizeBytes" integer NOT NULL,
    "mimeType" text NOT NULL,
    kind public."AttachmentKind" DEFAULT 'NOTE_INTERNAL'::public."AttachmentKind" NOT NULL,
    "addedByUserId" text,
    "addedByRole" public."StaffRole",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 232 (class 1259 OID 65922)
-- Name: AuditTrailEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditTrailEntry" (
    id text NOT NULL,
    "actorUserId" text,
    "entityType" text NOT NULL,
    "entityId" text NOT NULL,
    action text NOT NULL,
    "beforeJson" jsonb,
    "afterJson" jsonb,
    ip text,
    "userAgent" text,
    "prevHash" text,
    hash text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 227 (class 1259 OID 65878)
-- Name: Comment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Comment" (
    id text NOT NULL,
    "documentId" text NOT NULL,
    "authorUserId" text NOT NULL,
    "authorRole" public."StaffRole",
    body text NOT NULL,
    "parentCommentId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 222 (class 1259 OID 65834)
-- Name: Document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Document" (
    id text NOT NULL,
    reference text NOT NULL,
    subject text NOT NULL,
    nature public."DocumentNature" DEFAULT 'GENERAL_CORRESPONDENCE'::public."DocumentNature" NOT NULL,
    status public."DocumentStatus" DEFAULT 'RECEIVED'::public."DocumentStatus" NOT NULL,
    "currentHolderRole" public."StaffRole",
    "currentHolderUserId" text,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "acknowledgedAt" timestamp(3) without time zone,
    "dispatchedAt" timestamp(3) without time zone,
    "decidedAt" timestamp(3) without time zone,
    "responseSentAt" timestamp(3) without time zone,
    "closedAt" timestamp(3) without time zone,
    "sourceChannel" public."SourceChannel" NOT NULL,
    "antenneId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 224 (class 1259 OID 65853)
-- Name: DocumentVersion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DocumentVersion" (
    id text NOT NULL,
    "documentId" text NOT NULL,
    kind public."DocumentVersionKind" NOT NULL,
    "fileName" text NOT NULL,
    "storageUri" text NOT NULL,
    sha256 text NOT NULL,
    "sizeBytes" integer NOT NULL,
    "mimeType" text NOT NULL,
    "pageCount" integer,
    "ocrText" text,
    "ocrCompletedAt" timestamp(3) without time zone,
    "uploadedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "uploadedByUserId" text
);


--
-- TOC entry 231 (class 1259 OID 65913)
-- Name: ExternalTransmission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExternalTransmission" (
    id text NOT NULL,
    "documentId" text NOT NULL,
    recipient public."ExternalRecipient" NOT NULL,
    "recipientName" text,
    "recipientEmail" text,
    "recipientAddress" text,
    purpose text NOT NULL,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "sentByUserId" text NOT NULL,
    "expectedReturnAt" timestamp(3) without time zone,
    "receivedAt" timestamp(3) without time zone,
    "opinionStorageUri" text,
    "opinionSummary" text,
    status public."ExternalTransmissionStatus" DEFAULT 'PENDING'::public."ExternalTransmissionStatus" NOT NULL
);


--
-- TOC entry 226 (class 1259 OID 65870)
-- Name: Handoff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Handoff" (
    id text NOT NULL,
    "documentId" text NOT NULL,
    type public."HandoffType" NOT NULL,
    "fromRole" public."StaffRole",
    "fromUserId" text,
    "toRole" public."StaffRole",
    "toUserId" text,
    reason text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 230 (class 1259 OID 65903)
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "forUserId" text NOT NULL,
    "documentId" text,
    kind public."NotificationKind" NOT NULL,
    title text NOT NULL,
    body text,
    link text,
    read boolean DEFAULT false NOT NULL,
    emailed boolean DEFAULT false NOT NULL,
    "emailedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 219 (class 1259 OID 65813)
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 223 (class 1259 OID 65845)
-- Name: Submission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Submission" (
    id text NOT NULL,
    "documentId" text NOT NULL,
    "senderName" text NOT NULL,
    "senderEmail" text NOT NULL,
    "senderOrganization" text,
    "senderPhone" text,
    "senderAddress" text,
    "senderType" text,
    "submittedVia" public."SourceChannel" NOT NULL,
    "antenneId" text,
    "registeredAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "registeredByUserId" text,
    "acknowledgementSentAt" timestamp(3) without time zone,
    "acknowledgementCode" text
);


--
-- TOC entry 217 (class 1259 OID 65795)
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    "emailVerified" timestamp(3) without time zone,
    "passwordHash" text,
    name text,
    image text,
    "userType" public."UserType" DEFAULT 'STAFF'::public."UserType" NOT NULL,
    "staffRole" public."StaffRole",
    "antenneId" text,
    locale text DEFAULT 'fr'::text NOT NULL,
    status public."UserStatus" DEFAULT 'ACTIVE'::public."UserStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "lastLoginAt" timestamp(3) without time zone
);


--
-- TOC entry 220 (class 1259 OID 65820)
-- Name: VerificationToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerificationToken" (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 3569 (class 0 OID 65806)
-- Dependencies: 218
-- Data for Name: Account; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Account" (id, "userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope, id_token, session_state) FROM stdin;
\.


--
-- TOC entry 3580 (class 0 OID 65895)
-- Dependencies: 229
-- Data for Name: AiAnalysis; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AiAnalysis" (id, "documentId", kind, summary, "contentJson", "modelName", "tokensIn", "tokensOut", "generatedAt") FROM stdin;
\.


--
-- TOC entry 3572 (class 0 OID 65825)
-- Dependencies: 221
-- Data for Name: Antenne; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Antenne" (id, name, region, ville, address, "chefUserId", active, "createdAt", "updatedAt") FROM stdin;
cmpkbokxn00003zhpdc1dunfa	Antenne Littoral	Littoral	Douala	Bonanjo, immeuble API Littoral	cmpkbomex000a3zhpz1pxbxj4	t	2026-05-24 22:01:54.682	2026-05-24 22:01:56.75
\.


--
-- TOC entry 3576 (class 0 OID 65861)
-- Dependencies: 225
-- Data for Name: Assignment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Assignment" (id, "documentId", "assignedToRole", "assignedToUserId", "assignedByUserId", "assignedAt", instructions, status, "completedAt") FROM stdin;
\.


--
-- TOC entry 3579 (class 0 OID 65886)
-- Dependencies: 228
-- Data for Name: Attachment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Attachment" (id, "documentId", "fileName", "storageUri", sha256, "sizeBytes", "mimeType", kind, "addedByUserId", "addedByRole", "createdAt") FROM stdin;
\.


--
-- TOC entry 3583 (class 0 OID 65922)
-- Dependencies: 232
-- Data for Name: AuditTrailEntry; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AuditTrailEntry" (id, "actorUserId", "entityType", "entityId", action, "beforeJson", "afterJson", ip, "userAgent", "prevHash", hash, "createdAt") FROM stdin;
\.


--
-- TOC entry 3578 (class 0 OID 65878)
-- Dependencies: 227
-- Data for Name: Comment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Comment" (id, "documentId", "authorUserId", "authorRole", body, "parentCommentId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 3573 (class 0 OID 65834)
-- Dependencies: 222
-- Data for Name: Document; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Document" (id, reference, subject, nature, status, "currentHolderRole", "currentHolderUserId", "submittedAt", "acknowledgedAt", "dispatchedAt", "decidedAt", "responseSentAt", "closedAt", "sourceChannel", "antenneId", "createdAt", "updatedAt") FROM stdin;
cmpkbon0t000b3zhp2rstslfg	COURRIER-2026-000001	Demande d'agrément · Projet Centrale Solaire 50 MW	AGREMENT_REQUEST	AWAITING_DG_ANALYSIS	\N	\N	2026-05-24 20:01:57.384	2026-05-24 20:01:57.384	\N	\N	\N	\N	ONLINE	\N	2026-05-24 22:01:57.389	2026-05-24 22:01:57.389
\.


--
-- TOC entry 3575 (class 0 OID 65853)
-- Dependencies: 224
-- Data for Name: DocumentVersion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DocumentVersion" (id, "documentId", kind, "fileName", "storageUri", sha256, "sizeBytes", "mimeType", "pageCount", "ocrText", "ocrCompletedAt", "uploadedAt", "uploadedByUserId") FROM stdin;
cmpkbon0t000d3zhpj5bvaqvs	cmpkbon0t000b3zhp2rstslfg	ORIGINAL	demande-agrement-solar.pdf	seed://demande-agrement-solar.pdf	aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa	482300	application/pdf	\N	\N	\N	2026-05-24 22:01:57.389	\N
\.


--
-- TOC entry 3582 (class 0 OID 65913)
-- Dependencies: 231
-- Data for Name: ExternalTransmission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ExternalTransmission" (id, "documentId", recipient, "recipientName", "recipientEmail", "recipientAddress", purpose, "sentAt", "sentByUserId", "expectedReturnAt", "receivedAt", "opinionStorageUri", "opinionSummary", status) FROM stdin;
\.


--
-- TOC entry 3577 (class 0 OID 65870)
-- Dependencies: 226
-- Data for Name: Handoff; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Handoff" (id, "documentId", type, "fromRole", "fromUserId", "toRole", "toUserId", reason, "createdAt") FROM stdin;
cmpkbookj000f3zhpbptoy1wj	cmpkbon0t000b3zhp2rstslfg	COURRIER_TO_DG	CHEF_BUREAU_ARRIVEE	cmpkbom6m00063zhpndzs7dkq	DG	\N	Document reçu en ligne · transmis pour analyse DG.	2026-05-24 22:01:59.395
\.


--
-- TOC entry 3581 (class 0 OID 65903)
-- Dependencies: 230
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Notification" (id, "forUserId", "documentId", kind, title, body, link, read, emailed, "emailedAt", "createdAt") FROM stdin;
\.


--
-- TOC entry 3570 (class 0 OID 65813)
-- Dependencies: 219
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Session" (id, "sessionToken", "userId", expires) FROM stdin;
\.


--
-- TOC entry 3574 (class 0 OID 65845)
-- Dependencies: 223
-- Data for Name: Submission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Submission" (id, "documentId", "senderName", "senderEmail", "senderOrganization", "senderPhone", "senderAddress", "senderType", "submittedVia", "antenneId", "registeredAt", "registeredByUserId", "acknowledgementSentAt", "acknowledgementCode") FROM stdin;
cmpkbon0t000c3zhpdb1mtsaz	cmpkbon0t000b3zhp2rstslfg	Aïcha Bouba	contact@solarcm.cm	Cameroun Solar Power SA	+237 6 55 44 33 22	\N	Investisseur	ONLINE	\N	2026-05-24 20:01:57.384	\N	2026-05-24 20:01:57.384	COURRIER-2026-000001
\.


--
-- TOC entry 3568 (class 0 OID 65795)
-- Dependencies: 217
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, email, "emailVerified", "passwordHash", name, image, "userType", "staffRole", "antenneId", locale, status, "createdAt", "updatedAt", "lastLoginAt") FROM stdin;
cmpkboltn00023zhp0wdg6tec	admin@api.cm	2026-05-24 22:01:55.829	$2a$10$kQymQPJKcnakVA26wqTxpuOzxGd0yDduT3ZfngF47h8pmAA8okq56	Administrateur	\N	STAFF	ADMIN	\N	fr	ACTIVE	2026-05-24 22:01:55.835	2026-05-24 22:01:55.835	\N
cmpkbom2i00043zhp0t3ia300	dg@api.cm	2026-05-24 22:01:56.149	$2a$10$kQymQPJKcnakVA26wqTxpuOzxGd0yDduT3ZfngF47h8pmAA8okq56	Dr. Pierre Eyenga	\N	STAFF	DG	\N	fr	ACTIVE	2026-05-24 22:01:56.154	2026-05-24 22:01:56.154	\N
cmpkbom6m00063zhpndzs7dkq	arrivee@api.cm	2026-05-24 22:01:56.297	$2a$10$kQymQPJKcnakVA26wqTxpuOzxGd0yDduT3ZfngF47h8pmAA8okq56	Marie Etoundi	\N	STAFF	CHEF_BUREAU_ARRIVEE	\N	fr	ACTIVE	2026-05-24 22:01:56.302	2026-05-24 22:01:56.302	\N
cmpkbomap00083zhpoedf09o6	depart@api.cm	2026-05-24 22:01:56.444	$2a$10$kQymQPJKcnakVA26wqTxpuOzxGd0yDduT3ZfngF47h8pmAA8okq56	Paul Nkomo	\N	STAFF	CHEF_BUREAU_DEPART	\N	fr	ACTIVE	2026-05-24 22:01:56.449	2026-05-24 22:01:56.449	\N
cmpkbomex000a3zhpz1pxbxj4	antenne.littoral@api.cm	2026-05-24 22:01:56.596	$2a$10$kQymQPJKcnakVA26wqTxpuOzxGd0yDduT3ZfngF47h8pmAA8okq56	Hervé Bissek	\N	STAFF	CHEF_ANTENNE	cmpkbokxn00003zhpdc1dunfa	fr	ACTIVE	2026-05-24 22:01:56.601	2026-05-24 22:01:56.601	\N
\.


--
-- TOC entry 3571 (class 0 OID 65820)
-- Dependencies: 220
-- Data for Name: VerificationToken; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."VerificationToken" (identifier, token, expires) FROM stdin;
\.


--
-- TOC entry 3340 (class 2606 OID 65812)
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- TOC entry 3382 (class 2606 OID 65902)
-- Name: AiAnalysis AiAnalysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiAnalysis"
    ADD CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY (id);


--
-- TOC entry 3350 (class 2606 OID 65833)
-- Name: Antenne Antenne_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Antenne"
    ADD CONSTRAINT "Antenne_pkey" PRIMARY KEY (id);


--
-- TOC entry 3369 (class 2606 OID 65869)
-- Name: Assignment Assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Assignment"
    ADD CONSTRAINT "Assignment_pkey" PRIMARY KEY (id);


--
-- TOC entry 3379 (class 2606 OID 65894)
-- Name: Attachment Attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_pkey" PRIMARY KEY (id);


--
-- TOC entry 3395 (class 2606 OID 65929)
-- Name: AuditTrailEntry AuditTrailEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditTrailEntry"
    ADD CONSTRAINT "AuditTrailEntry_pkey" PRIMARY KEY (id);


--
-- TOC entry 3376 (class 2606 OID 65885)
-- Name: Comment Comment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_pkey" PRIMARY KEY (id);


--
-- TOC entry 3364 (class 2606 OID 65860)
-- Name: DocumentVersion DocumentVersion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentVersion"
    ADD CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY (id);


--
-- TOC entry 3354 (class 2606 OID 65844)
-- Name: Document Document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_pkey" PRIMARY KEY (id);


--
-- TOC entry 3389 (class 2606 OID 65921)
-- Name: ExternalTransmission ExternalTransmission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExternalTransmission"
    ADD CONSTRAINT "ExternalTransmission_pkey" PRIMARY KEY (id);


--
-- TOC entry 3372 (class 2606 OID 65877)
-- Name: Handoff Handoff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Handoff"
    ADD CONSTRAINT "Handoff_pkey" PRIMARY KEY (id);


--
-- TOC entry 3386 (class 2606 OID 65912)
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- TOC entry 3343 (class 2606 OID 65819)
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- TOC entry 3360 (class 2606 OID 65852)
-- Name: Submission Submission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_pkey" PRIMARY KEY (id);


--
-- TOC entry 3336 (class 2606 OID 65805)
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- TOC entry 3341 (class 1259 OID 65933)
-- Name: Account_provider_providerAccountId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON public."Account" USING btree (provider, "providerAccountId");


--
-- TOC entry 3380 (class 1259 OID 65954)
-- Name: AiAnalysis_documentId_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiAnalysis_documentId_kind_idx" ON public."AiAnalysis" USING btree ("documentId", kind);


--
-- TOC entry 3347 (class 1259 OID 65938)
-- Name: Antenne_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Antenne_active_idx" ON public."Antenne" USING btree (active);


--
-- TOC entry 3348 (class 1259 OID 65937)
-- Name: Antenne_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Antenne_name_key" ON public."Antenne" USING btree (name);


--
-- TOC entry 3365 (class 1259 OID 65949)
-- Name: Assignment_assignedToRole_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_assignedToRole_idx" ON public."Assignment" USING btree ("assignedToRole");


--
-- TOC entry 3366 (class 1259 OID 65948)
-- Name: Assignment_assignedToUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_assignedToUserId_idx" ON public."Assignment" USING btree ("assignedToUserId");


--
-- TOC entry 3367 (class 1259 OID 65947)
-- Name: Assignment_documentId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Assignment_documentId_status_idx" ON public."Assignment" USING btree ("documentId", status);


--
-- TOC entry 3377 (class 1259 OID 65953)
-- Name: Attachment_documentId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attachment_documentId_createdAt_idx" ON public."Attachment" USING btree ("documentId", "createdAt");


--
-- TOC entry 3391 (class 1259 OID 65961)
-- Name: AuditTrailEntry_actorUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditTrailEntry_actorUserId_idx" ON public."AuditTrailEntry" USING btree ("actorUserId");


--
-- TOC entry 3392 (class 1259 OID 65960)
-- Name: AuditTrailEntry_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditTrailEntry_createdAt_idx" ON public."AuditTrailEntry" USING btree ("createdAt");


--
-- TOC entry 3393 (class 1259 OID 65959)
-- Name: AuditTrailEntry_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditTrailEntry_entityType_entityId_idx" ON public."AuditTrailEntry" USING btree ("entityType", "entityId");


--
-- TOC entry 3374 (class 1259 OID 65952)
-- Name: Comment_documentId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Comment_documentId_createdAt_idx" ON public."Comment" USING btree ("documentId", "createdAt");


--
-- TOC entry 3362 (class 1259 OID 65946)
-- Name: DocumentVersion_documentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DocumentVersion_documentId_idx" ON public."DocumentVersion" USING btree ("documentId");


--
-- TOC entry 3351 (class 1259 OID 65941)
-- Name: Document_currentHolderRole_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Document_currentHolderRole_idx" ON public."Document" USING btree ("currentHolderRole");


--
-- TOC entry 3352 (class 1259 OID 65942)
-- Name: Document_currentHolderUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Document_currentHolderUserId_idx" ON public."Document" USING btree ("currentHolderUserId");


--
-- TOC entry 3355 (class 1259 OID 65939)
-- Name: Document_reference_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Document_reference_key" ON public."Document" USING btree (reference);


--
-- TOC entry 3356 (class 1259 OID 65940)
-- Name: Document_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Document_status_idx" ON public."Document" USING btree (status);


--
-- TOC entry 3387 (class 1259 OID 65957)
-- Name: ExternalTransmission_documentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExternalTransmission_documentId_idx" ON public."ExternalTransmission" USING btree ("documentId");


--
-- TOC entry 3390 (class 1259 OID 65958)
-- Name: ExternalTransmission_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExternalTransmission_status_idx" ON public."ExternalTransmission" USING btree (status);


--
-- TOC entry 3370 (class 1259 OID 65950)
-- Name: Handoff_documentId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Handoff_documentId_createdAt_idx" ON public."Handoff" USING btree ("documentId", "createdAt");


--
-- TOC entry 3373 (class 1259 OID 65951)
-- Name: Handoff_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Handoff_type_idx" ON public."Handoff" USING btree (type);


--
-- TOC entry 3383 (class 1259 OID 65956)
-- Name: Notification_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_createdAt_idx" ON public."Notification" USING btree ("createdAt");


--
-- TOC entry 3384 (class 1259 OID 65955)
-- Name: Notification_forUserId_read_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_forUserId_read_idx" ON public."Notification" USING btree ("forUserId", read);


--
-- TOC entry 3344 (class 1259 OID 65934)
-- Name: Session_sessionToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");


--
-- TOC entry 3357 (class 1259 OID 65945)
-- Name: Submission_acknowledgementCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_acknowledgementCode_idx" ON public."Submission" USING btree ("acknowledgementCode");


--
-- TOC entry 3358 (class 1259 OID 65943)
-- Name: Submission_documentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Submission_documentId_key" ON public."Submission" USING btree ("documentId");


--
-- TOC entry 3361 (class 1259 OID 65944)
-- Name: Submission_senderEmail_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_senderEmail_idx" ON public."Submission" USING btree ("senderEmail");


--
-- TOC entry 3334 (class 1259 OID 65930)
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- TOC entry 3337 (class 1259 OID 65932)
-- Name: User_staffRole_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_staffRole_idx" ON public."User" USING btree ("staffRole");


--
-- TOC entry 3338 (class 1259 OID 65931)
-- Name: User_userType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_userType_idx" ON public."User" USING btree ("userType");


--
-- TOC entry 3345 (class 1259 OID 65936)
-- Name: VerificationToken_identifier_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON public."VerificationToken" USING btree (identifier, token);


--
-- TOC entry 3346 (class 1259 OID 65935)
-- Name: VerificationToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_token_key" ON public."VerificationToken" USING btree (token);


--
-- TOC entry 3397 (class 2606 OID 65967)
-- Name: Account Account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3417 (class 2606 OID 66067)
-- Name: AiAnalysis AiAnalysis_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiAnalysis"
    ADD CONSTRAINT "AiAnalysis_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3399 (class 2606 OID 65977)
-- Name: Antenne Antenne_chefUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Antenne"
    ADD CONSTRAINT "Antenne_chefUserId_fkey" FOREIGN KEY ("chefUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3406 (class 2606 OID 66022)
-- Name: Assignment Assignment_assignedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Assignment"
    ADD CONSTRAINT "Assignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3407 (class 2606 OID 66017)
-- Name: Assignment Assignment_assignedToUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Assignment"
    ADD CONSTRAINT "Assignment_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3408 (class 2606 OID 66012)
-- Name: Assignment Assignment_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Assignment"
    ADD CONSTRAINT "Assignment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3415 (class 2606 OID 66062)
-- Name: Attachment Attachment_addedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3416 (class 2606 OID 66057)
-- Name: Attachment Attachment_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3422 (class 2606 OID 66092)
-- Name: AuditTrailEntry AuditTrailEntry_actorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditTrailEntry"
    ADD CONSTRAINT "AuditTrailEntry_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3412 (class 2606 OID 66047)
-- Name: Comment Comment_authorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3413 (class 2606 OID 66042)
-- Name: Comment Comment_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3414 (class 2606 OID 66052)
-- Name: Comment Comment_parentCommentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES public."Comment"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3404 (class 2606 OID 66002)
-- Name: DocumentVersion DocumentVersion_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentVersion"
    ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3405 (class 2606 OID 66007)
-- Name: DocumentVersion DocumentVersion_uploadedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentVersion"
    ADD CONSTRAINT "DocumentVersion_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3400 (class 2606 OID 65982)
-- Name: Document Document_antenneId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_antenneId_fkey" FOREIGN KEY ("antenneId") REFERENCES public."Antenne"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3420 (class 2606 OID 66082)
-- Name: ExternalTransmission ExternalTransmission_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExternalTransmission"
    ADD CONSTRAINT "ExternalTransmission_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3421 (class 2606 OID 66087)
-- Name: ExternalTransmission ExternalTransmission_sentByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExternalTransmission"
    ADD CONSTRAINT "ExternalTransmission_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 3409 (class 2606 OID 66027)
-- Name: Handoff Handoff_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Handoff"
    ADD CONSTRAINT "Handoff_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3410 (class 2606 OID 66032)
-- Name: Handoff Handoff_fromUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Handoff"
    ADD CONSTRAINT "Handoff_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3411 (class 2606 OID 66037)
-- Name: Handoff Handoff_toUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Handoff"
    ADD CONSTRAINT "Handoff_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3418 (class 2606 OID 66077)
-- Name: Notification Notification_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3419 (class 2606 OID 66072)
-- Name: Notification Notification_forUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_forUserId_fkey" FOREIGN KEY ("forUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3398 (class 2606 OID 65972)
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3401 (class 2606 OID 65992)
-- Name: Submission Submission_antenneId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_antenneId_fkey" FOREIGN KEY ("antenneId") REFERENCES public."Antenne"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3402 (class 2606 OID 65987)
-- Name: Submission Submission_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3403 (class 2606 OID 65997)
-- Name: Submission Submission_registeredByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_registeredByUserId_fkey" FOREIGN KEY ("registeredByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 3396 (class 2606 OID 65962)
-- Name: User User_antenneId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_antenneId_fkey" FOREIGN KEY ("antenneId") REFERENCES public."Antenne"(id) ON UPDATE CASCADE ON DELETE SET NULL;


-- Completed on 2026-05-25 00:52:05

--
-- PostgreSQL database dump complete
--

\unrestrict oN7JjS0R4EySANenKpZk9YXxxXkzXsP15eRKBRuF4jFse8g8XSJ8db89XmFoMvm

