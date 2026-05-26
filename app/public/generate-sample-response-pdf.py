"""
One-shot script to regenerate public/sample-response.pdf.
A fictional "décision favorable d'agrément" from the DG — used as the
test response PDF for B5 (Bureau Départ).
Run from app/:  PYTHONIOENCODING=utf-8 python public/generate-sample-response-pdf.py
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from pathlib import Path

GREEN = HexColor("#006b3a")
GOLD = HexColor("#c1973f")
INK = HexColor("#0a0a0a")
INK_3 = HexColor("#5a5a5a")
GOLD_BG = HexColor("#fbf8f1")

OUT = Path(__file__).parent / "sample-response.pdf"


def build():
    doc = SimpleDocTemplate(
        str(OUT), pagesize=A4,
        leftMargin=22 * mm, rightMargin=22 * mm,
        topMargin=22 * mm, bottomMargin=22 * mm,
        title="Decision favorable d'agrement (echantillon de test - B5)",
        author="Agence de Promotion des Investissements du Cameroun",
        subject="Test response document for cmipaportal.com",
    )

    s = getSampleStyleSheet()
    kicker = ParagraphStyle("kicker", parent=s["Normal"], fontName="Helvetica-Bold",
                            fontSize=8, leading=10, textColor=INK_3, spaceAfter=4)
    title_block = ParagraphStyle("title", parent=s["Normal"], fontName="Helvetica-Bold",
                                 fontSize=12, textColor=GREEN, spaceAfter=4)
    sub = ParagraphStyle("sub", parent=s["Normal"], fontName="Helvetica",
                         fontSize=9, leading=12, textColor=INK)
    to_block = ParagraphStyle("to", parent=s["Normal"], fontName="Helvetica",
                              fontSize=10, leading=13, textColor=INK,
                              alignment=TA_RIGHT, spaceBefore=18, spaceAfter=16)
    ref_line = ParagraphStyle("ref", parent=s["Normal"], fontName="Helvetica",
                              fontSize=9, leading=12, textColor=INK_3)
    object_style = ParagraphStyle("object", parent=s["Normal"], fontName="Helvetica-Bold",
                                  fontSize=10.5, leading=14, textColor=INK, backColor=GOLD_BG,
                                  borderColor=GOLD, borderWidth=0,
                                  borderPadding=(8, 8, 8, 8), leftIndent=4,
                                  spaceBefore=14, spaceAfter=18)
    body = ParagraphStyle("body", parent=s["Normal"], fontName="Times-Roman",
                          fontSize=11, leading=15, textColor=INK,
                          alignment=TA_JUSTIFY, spaceAfter=10)
    h2 = ParagraphStyle("h2", parent=s["Normal"], fontName="Times-Bold",
                        fontSize=12.5, leading=15, textColor=GREEN,
                        spaceBefore=14, spaceAfter=6)
    article = ParagraphStyle("article", parent=body, fontName="Times-Italic",
                             leftIndent=14, spaceAfter=6)
    sig_name = ParagraphStyle("sigName", parent=s["Normal"], fontName="Helvetica-Bold",
                              fontSize=11, leading=13, textColor=INK, alignment=TA_RIGHT)
    sig_title = ParagraphStyle("sigTitle", parent=s["Normal"], fontName="Helvetica-Oblique",
                               fontSize=9.5, leading=12, textColor=INK_3, alignment=TA_RIGHT)

    flow = []

    flow.append(Paragraph("REPUBLIQUE DU CAMEROUN  |  PAIX - TRAVAIL - PATRIE", kicker))
    flow.append(Paragraph("Agence de Promotion des Investissements", title_block))
    flow.append(Paragraph(
        "Direction Generale<br/>"
        "BP 18036 Yaounde - Cameroun<br/>"
        "Tel. : +237 2 22 22 51 51 - contact@api.cm",
        sub,
    ))

    flow.append(Paragraph(
        "A Madame la Directrice Generale<br/>"
        "<b>Cameroun Solar Power SA</b><br/>"
        "Quartier Bonanjo, immeuble Atlantique<br/>"
        "Douala - Cameroun",
        to_block,
    ))

    flow.append(Paragraph("N/Ref. : DG/API/2026/AGR/0042", ref_line))
    flow.append(Paragraph("V/Ref. : SP-2026-INV-007", ref_line))
    flow.append(Paragraph("Date  : Yaounde, le 26 mai 2026", ref_line))

    flow.append(Paragraph(
        "Objet : Notification de decision favorable - Agrement au regime des grands "
        "investissements pour le projet de centrale solaire photovoltaique de 50 MW a Edea.",
        object_style,
    ))

    flow.append(Paragraph("Madame la Directrice Generale,", body))

    flow.append(Paragraph(
        "J'ai l'honneur d'accuser reception de votre demande sous reference SP-2026-INV-007, "
        "enregistree sous reference officielle <b>COURRIER-2026-000001</b>, sollicitant "
        "l'octroi de l'agrement au regime des grands investissements pour le projet de "
        "centrale solaire photovoltaique de 50 MW a Edea, departement de la Sanaga-Maritime.",
        body,
    ))

    flow.append(Paragraph(
        "Au terme de l'instruction conduite par les Services competents de notre Agence, "
        "et apres avis favorable des Ministeres concernes, j'ai le plaisir de vous notifier "
        "la <b>decision favorable</b> de l'Agence de Promotion des Investissements concernant "
        "votre demande.",
        body,
    ))

    flow.append(Paragraph("Conditions et avantages octroyes", h2))
    flow.append(Paragraph(
        "Conformement aux dispositions de l'Ordonnance n. 2025/002 du 18 juillet 2025 "
        "et de son decret d'application n. 2025-048, votre projet beneficie des avantages "
        "suivants au regime des grands investissements :",
        body,
    ))
    flow.append(Paragraph(
        "Art. 1 - Exoneration totale des droits de douane sur les equipements importes "
        "pendant les 24 mois de la phase de construction.",
        article,
    ))
    flow.append(Paragraph(
        "Art. 2 - Exoneration de l'impot sur les societes pendant les cinq (5) premieres "
        "annees d'exploitation, puis taux reduit de 50 % pendant les cinq (5) annees suivantes.",
        article,
    ))
    flow.append(Paragraph(
        "Art. 3 - Stabilite reglementaire et fiscale garantie pendant la duree "
        "d'amortissement du projet (15 ans).",
        article,
    ))
    flow.append(Paragraph(
        "Art. 4 - Acces prioritaire aux servitudes de raccordement au reseau haute tension "
        "via la SONATREL.",
        article,
    ))

    flow.append(Paragraph("Engagements de l'investisseur", h2))
    flow.append(Paragraph(
        "En contrepartie, votre societe s'engage formellement a :",
        body,
    ))
    flow.append(Paragraph(
        "- Demarrer effectivement les travaux dans un delai maximum de douze (12) mois "
        "a compter de la presente notification;",
        article,
    ))
    flow.append(Paragraph(
        "- Maintenir un taux minimum de 90 % de main-d'oeuvre nationale en phase d'exploitation;",
        article,
    ))
    flow.append(Paragraph(
        "- Transmettre a notre Agence un rapport semestriel d'avancement du projet, "
        "comportant les elements financiers, techniques et sociaux;",
        article,
    ))
    flow.append(Paragraph(
        "- Respecter integralement les prescriptions de l'etude d'impact environnemental "
        "validee par le Ministere de l'Environnement.",
        article,
    ))

    flow.append(Paragraph(
        "La convention d'agrement formalisant le present accord vous sera transmise sous "
        "huitaine pour signature dans nos locaux. Je vous prie de bien vouloir convenir d'un "
        "rendez-vous avec notre Direction de la Facilitation a cet effet.",
        body,
    ))

    flow.append(Paragraph(
        "Je vous prie d'agreer, Madame la Directrice Generale, l'expression de ma "
        "consideration distinguee.",
        body,
    ))

    flow.append(Spacer(1, 30))
    flow.append(Paragraph("Le Directeur General", sig_title))
    flow.append(Spacer(1, 26))
    flow.append(Paragraph("Dr. Pierre EYENGA", sig_name))

    flow.append(Spacer(1, 28))
    flow.append(Paragraph(
        "Cet exemplaire est un echantillon de test destine a la plateforme cmipaportal.com - "
        "il ne constitue pas une decision reelle.",
        ParagraphStyle("footer", parent=body, fontSize=8.5, textColor=INK_3,
                       fontName="Times-Italic", alignment=TA_LEFT),
    ))

    doc.build(flow)
    print(f"Wrote {OUT}  ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    build()
