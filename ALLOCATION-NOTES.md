# 2026 FIFA World Cup — Allocation of the 8 Best Third-Placed Teams to Round-of-32 Slots

Research date: 2026-06-11. Primary source: official FIFA regulations PDF (downloaded and parsed, see Sources).

## VERDICT: FIXED LOOKUP TABLE (fully published, deterministic, no FIFA discretion)

The allocation is **not** a procedure executed on the ranking and **not** discretionary. FIFA published, in
**Annexe C of the "Regulations for the FIFA World Cup 26"**, a complete enumeration of all
C(12,8) = 495 possible combinations of which eight groups' third-placed teams qualify, and for each
combination the exact assignment of each qualifying third to a specific Round-of-32 match. The set of
8 qualifying groups uniquely selects one row; the row dictates every slot. The *rank order* among the
8 qualifiers is irrelevant to slot assignment — the ranking of thirds (Art. 13 criteria) only determines
*which* 8 qualify.

Load-bearing verbatim quotes from the regulations (soft hyphens restored):

> **12.5** "The 12 teams finishing first and second in each group as well as the eight best teams among
> those finishing third will qualify for the round of 32."

> (Art. 12.6, immediately after the round-of-32 match list:) "Annexe C of these Regulations includes the
> 495 different possible combinations of the eight best-ranked third-placed teams and their next match-up
> for the round of 32, at the completion of the group stage."

> (Note under 12.6:) "the above configuration of matches for the round of 32 does not necessarily
> represent the chronological order in which the matches will be played as teams from the same group
> shall not meet each other in the round of 32."

Annexe C is titled (PDF p. 80): **"ANNEXE C. COMBINATIONS FOR EIGHT BEST THIRD-PLACED TEAMS"**, with
column header `Option  1A  1B  1D  1E  1G  1I  1K  1L` followed by rows `1 .. 495`, each row listing the
eight third-placed teams (e.g. `1  3E  3J  3I  3F  3H  3G  3L  3K`). Columns are the **group winners the
thirds are matched against**; each of those winners appears in exactly one R32 match, giving the
column → match-number mapping below.

## Implementable algorithm

```
Input:  ranking of the 12 third-placed teams (FIFA Art. 13 / "eight best thirds" criteria a-f below)
1. Q = set of group letters of the 8 best-ranked thirds.        # only set membership matters
2. row = the unique Annexe C row whose eight assigned thirds (as a set) == Q.
   # Annexe C covers each of the 495 possible 8-subsets of {A..L} exactly once (machine-verified).
3. Assign (third-placed team occupies the SECOND listed / "Team B" / away slot of each match):
     Match 74  (vs Winner E) = row[col 1E]
     Match 77  (vs Winner I) = row[col 1I]
     Match 79  (vs Winner A) = row[col 1A]
     Match 80  (vs Winner L) = row[col 1L]
     Match 81  (vs Winner D) = row[col 1D]
     Match 82  (vs Winner G) = row[col 1G]
     Match 85  (vs Winner B) = row[col 1B]
     Match 87  (vs Winner K) = row[col 1K]
```
Practical implementation: index the table by `frozenset(qualified_groups)` → dict of 8 match assignments.
The full machine-readable table is embedded at the bottom of this file and also written to
`annexe_c_table.csv` in this directory (parsed from the official PDF, validated as described below).

Ranking criteria that determine WHICH 8 thirds qualify (regs, "The eight best teams among those ranked
third will be determined as follows"): a) points; b) goal difference; c) goals scored; d) team conduct
score (yellow/red cards per Art. 13 par. 1 step 2); e) FIFA/Coca-Cola Men's World Ranking (most recent
edition); f) preceding World Ranking editions until decided. (No drawing of lots in the published list.)

## Per-slot eligibility (all 8 third-place R32 slots)

Identical in the official regulations (Art. 12.6) and Wikipedia's bracket labels. Eligible-group sets
have FIVE groups per slot (unlike the 3-4 of the 2018/Euro 16-team format). Dates/venues from Wikipedia
for template cross-checking:

| Match | Home (Team A) | Away (Team B) = third of | Date / venue |
|-------|---------------|--------------------------|--------------|
| M74 | Winner Group E | 3rd of A/B/C/D/F | Jun 29, Foxborough |
| M77 | Winner Group I | 3rd of C/D/F/G/H | Jun 30, East Rutherford |
| M79 | Winner Group A | 3rd of C/E/F/H/I | Jun 30, Mexico City |
| M80 | Winner Group L | 3rd of E/H/I/J/K | Jul 1, Atlanta |
| M81 | Winner Group D | 3rd of B/E/F/I/J | Jul 1, Santa Clara |
| M82 | Winner Group G | 3rd of A/E/H/I/J | Jul 1, Seattle |
| M85 | Winner Group B | 3rd of E/F/G/I/J | Jul 2, Vancouver |
| M87 | Winner Group K | 3rd of D/E/I/J/L | Jul 3, Kansas City |

Derived from the 495 rows (useful sanity checks for a simulator — possible destinations per group):
3A→{74,82}; 3B→{74,81}; 3C→{74,77,79}; 3D→{74,77,87}; 3E→{79,80,81,82,85,87};
3F→{74,77,79,81,85}; 3G→{77,85}; 3H→{77,79,80,82}; 3I→{79,80,81,82,85,87};
3J→{80,81,82,85,87}; 3K→{80 only}; 3L→{87 only}.
Note the strong asymmetry: if 3K qualifies it ALWAYS plays Winner L (M80); if 3L qualifies it ALWAYS
plays Winner K (M87); whereas 3E/3I each have six possible destinations.

## Validation performed (parse of official PDF text, pdftotext -layout)

- 495 rows parsed; option numbers 1-495 each present exactly once; no conflicting duplicates.
- Every row contains 8 distinct group letters; the 495 row-sets are pairwise distinct and equal the full
  set of C(12,8) combinations of {A..L} — complete and unambiguous coverage.
- Zero eligibility violations across all 3,960 cells; moreover the attained value set of each column
  EXACTLY equals the published 5-group eligibility set of its match (e.g. col 1A attains {C,E,F,H,I}),
  which also uniquely pins the column → match mapping (all 8 attained sets are distinct).

## Sources

1. Official: "Regulations for the FIFA World Cup 26", Articles 12.5-12.6 and Annexe C —
   https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf
   (local copy: `_fifa_regs.pdf`; re-extract with `pdftotext -layout _fifa_regs.pdf`).
2. Wikipedia, "2026 FIFA World Cup knockout stage" (slot labels cross-checked against raw wikitext) —
   https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage
   ("The 495 possible combinations were published in Annex C of the tournament regulations.")
3. Secondary explainers agreeing on the 495-combination mechanism: FIFA.com groups explainer
   (https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/groups-how-teams-qualify-tie-breakers),
   ESPN (https://www.espn.com/soccer/story/_/id/48703925/world-cup-group-stage-explained-tiebreakers-third-place-teams),
   Sportmonks bracket-building guide.

## Confidence assessment

**HIGH.** The method comes verbatim from FIFA's official regulations PDF (primary source), the full
Annexe C table was machine-parsed and passed exhaustive integrity checks (completeness, uniqueness,
eligibility), and the independent Wikipedia bracket labels match the regulations exactly. No
discrepancies found between sources. Residual risks: none identified for the allocation logic itself;
only kickoff scheduling (not slot identity) is subject to FIFA's "chronological order" caveat.

## Full Annexe C lookup table (machine-readable)

Columns: option number; the 8 qualifying groups (sorted); then the group letter of the third assigned to
each match (column names give match number and opposing group winner).

```csv
option,qualified_groups,M79_vs_1A,M85_vs_1B,M81_vs_1D,M74_vs_1E,M82_vs_1G,M77_vs_1I,M87_vs_1K,M80_vs_1L
1,EFGHIJKL,E,J,I,F,H,G,L,K
2,DFGHIJKL,H,G,I,D,J,F,L,K
3,DEGHIJKL,E,J,I,D,H,G,L,K
4,DEFHIJKL,E,J,I,D,H,F,L,K
5,DEFGIJKL,E,G,I,D,J,F,L,K
6,DEFGHJKL,E,G,J,D,H,F,L,K
7,DEFGHIKL,E,G,I,D,H,F,L,K
8,DEFGHIJL,E,G,J,D,H,F,L,I
9,DEFGHIJK,E,G,J,D,H,F,I,K
10,CFGHIJKL,H,G,I,C,J,F,L,K
11,CEGHIJKL,E,J,I,C,H,G,L,K
12,CEFHIJKL,E,J,I,C,H,F,L,K
13,CEFGIJKL,E,G,I,C,J,F,L,K
14,CEFGHJKL,E,G,J,C,H,F,L,K
15,CEFGHIKL,E,G,I,C,H,F,L,K
16,CEFGHIJL,E,G,J,C,H,F,L,I
17,CEFGHIJK,E,G,J,C,H,F,I,K
18,CDGHIJKL,H,G,I,C,J,D,L,K
19,CDFHIJKL,C,J,I,D,H,F,L,K
20,CDFGIJKL,C,G,I,D,J,F,L,K
21,CDFGHJKL,C,G,J,D,H,F,L,K
22,CDFGHIKL,C,G,I,D,H,F,L,K
23,CDFGHIJL,C,G,J,D,H,F,L,I
24,CDFGHIJK,C,G,J,D,H,F,I,K
25,CDEHIJKL,E,J,I,C,H,D,L,K
26,CDEGIJKL,E,G,I,C,J,D,L,K
27,CDEGHJKL,E,G,J,C,H,D,L,K
28,CDEGHIKL,E,G,I,C,H,D,L,K
29,CDEGHIJL,E,G,J,C,H,D,L,I
30,CDEGHIJK,E,G,J,C,H,D,I,K
31,CDEFIJKL,C,J,E,D,I,F,L,K
32,CDEFHJKL,C,J,E,D,H,F,L,K
33,CDEFHIKL,C,E,I,D,H,F,L,K
34,CDEFHIJL,C,J,E,D,H,F,L,I
35,CDEFHIJK,C,J,E,D,H,F,I,K
36,CDEFGJKL,C,G,E,D,J,F,L,K
37,CDEFGIKL,C,G,E,D,I,F,L,K
38,CDEFGIJL,C,G,E,D,J,F,L,I
39,CDEFGIJK,C,G,E,D,J,F,I,K
40,CDEFGHKL,C,G,E,D,H,F,L,K
41,CDEFGHJL,C,G,J,D,H,F,L,E
42,CDEFGHJK,C,G,J,D,H,F,E,K
43,CDEFGHIL,C,G,E,D,H,F,L,I
44,CDEFGHIK,C,G,E,D,H,F,I,K
45,CDEFGHIJ,C,G,J,D,H,F,E,I
46,BFGHIJKL,H,J,B,F,I,G,L,K
47,BEGHIJKL,E,J,I,B,H,G,L,K
48,BEFHIJKL,E,J,B,F,I,H,L,K
49,BEFGIJKL,E,J,B,F,I,G,L,K
50,BEFGHJKL,E,J,B,F,H,G,L,K
51,BEFGHIKL,E,G,B,F,I,H,L,K
52,BEFGHIJL,E,J,B,F,H,G,L,I
53,BEFGHIJK,E,J,B,F,H,G,I,K
54,BDGHIJKL,H,J,B,D,I,G,L,K
55,BDFHIJKL,H,J,B,D,I,F,L,K
56,BDFGIJKL,I,G,B,D,J,F,L,K
57,BDFGHJKL,H,G,B,D,J,F,L,K
58,BDFGHIKL,H,G,B,D,I,F,L,K
59,BDFGHIJL,H,G,B,D,J,F,L,I
60,BDFGHIJK,H,G,B,D,J,F,I,K
61,BDEHIJKL,E,J,B,D,I,H,L,K
62,BDEGIJKL,E,J,B,D,I,G,L,K
63,BDEGHJKL,E,J,B,D,H,G,L,K
64,BDEGHIKL,E,G,B,D,I,H,L,K
65,BDEGHIJL,E,J,B,D,H,G,L,I
66,BDEGHIJK,E,J,B,D,H,G,I,K
67,BDEFIJKL,E,J,B,D,I,F,L,K
68,BDEFHJKL,E,J,B,D,H,F,L,K
69,BDEFHIKL,E,I,B,D,H,F,L,K
70,BDEFHIJL,E,J,B,D,H,F,L,I
71,BDEFHIJK,E,J,B,D,H,F,I,K
72,BDEFGJKL,E,G,B,D,J,F,L,K
73,BDEFGIKL,E,G,B,D,I,F,L,K
74,BDEFGIJL,E,G,B,D,J,F,L,I
75,BDEFGIJK,E,G,B,D,J,F,I,K
76,BDEFGHKL,E,G,B,D,H,F,L,K
77,BDEFGHJL,H,G,B,D,J,F,L,E
78,BDEFGHJK,H,G,B,D,J,F,E,K
79,BDEFGHIL,E,G,B,D,H,F,L,I
80,BDEFGHIK,E,G,B,D,H,F,I,K
81,BDEFGHIJ,H,G,B,D,J,F,E,I
82,BCGHIJKL,H,J,B,C,I,G,L,K
83,BCFHIJKL,H,J,B,C,I,F,L,K
84,BCFGIJKL,I,G,B,C,J,F,L,K
85,BCFGHJKL,H,G,B,C,J,F,L,K
86,BCFGHIKL,H,G,B,C,I,F,L,K
87,BCFGHIJL,H,G,B,C,J,F,L,I
88,BCFGHIJK,H,G,B,C,J,F,I,K
89,BCEHIJKL,E,J,B,C,I,H,L,K
90,BCEGIJKL,E,J,B,C,I,G,L,K
91,BCEGHJKL,E,J,B,C,H,G,L,K
92,BCEGHIKL,E,G,B,C,I,H,L,K
93,BCEGHIJL,E,J,B,C,H,G,L,I
94,BCEGHIJK,E,J,B,C,H,G,I,K
95,BCEFIJKL,E,J,B,C,I,F,L,K
96,BCEFHJKL,E,J,B,C,H,F,L,K
97,BCEFHIKL,E,I,B,C,H,F,L,K
98,BCEFHIJL,E,J,B,C,H,F,L,I
99,BCEFHIJK,E,J,B,C,H,F,I,K
100,BCEFGJKL,E,G,B,C,J,F,L,K
101,BCEFGIKL,E,G,B,C,I,F,L,K
102,BCEFGIJL,E,G,B,C,J,F,L,I
103,BCEFGIJK,E,G,B,C,J,F,I,K
104,BCEFGHKL,E,G,B,C,H,F,L,K
105,BCEFGHJL,H,G,B,C,J,F,L,E
106,BCEFGHJK,H,G,B,C,J,F,E,K
107,BCEFGHIL,E,G,B,C,H,F,L,I
108,BCEFGHIK,E,G,B,C,H,F,I,K
109,BCEFGHIJ,H,G,B,C,J,F,E,I
110,BCDHIJKL,H,J,B,C,I,D,L,K
111,BCDGIJKL,I,G,B,C,J,D,L,K
112,BCDGHJKL,H,G,B,C,J,D,L,K
113,BCDGHIKL,H,G,B,C,I,D,L,K
114,BCDGHIJL,H,G,B,C,J,D,L,I
115,BCDGHIJK,H,G,B,C,J,D,I,K
116,BCDFIJKL,C,J,B,D,I,F,L,K
117,BCDFHJKL,C,J,B,D,H,F,L,K
118,BCDFHIKL,C,I,B,D,H,F,L,K
119,BCDFHIJL,C,J,B,D,H,F,L,I
120,BCDFHIJK,C,J,B,D,H,F,I,K
121,BCDFGJKL,C,G,B,D,J,F,L,K
122,BCDFGIKL,C,G,B,D,I,F,L,K
123,BCDFGIJL,C,G,B,D,J,F,L,I
124,BCDFGIJK,C,G,B,D,J,F,I,K
125,BCDFGHKL,C,G,B,D,H,F,L,K
126,BCDFGHJL,C,G,B,D,H,F,L,J
127,BCDFGHJK,H,G,B,C,J,F,D,K
128,BCDFGHIL,C,G,B,D,H,F,L,I
129,BCDFGHIK,C,G,B,D,H,F,I,K
130,BCDFGHIJ,H,G,B,C,J,F,D,I
131,BCDEIJKL,E,J,B,C,I,D,L,K
132,BCDEHJKL,E,J,B,C,H,D,L,K
133,BCDEHIKL,E,I,B,C,H,D,L,K
134,BCDEHIJL,E,J,B,C,H,D,L,I
135,BCDEHIJK,E,J,B,C,H,D,I,K
136,BCDEGJKL,E,G,B,C,J,D,L,K
137,BCDEGIKL,E,G,B,C,I,D,L,K
138,BCDEGIJL,E,G,B,C,J,D,L,I
139,BCDEGIJK,E,G,B,C,J,D,I,K
140,BCDEGHKL,E,G,B,C,H,D,L,K
141,BCDEGHJL,H,G,B,C,J,D,L,E
142,BCDEGHJK,H,G,B,C,J,D,E,K
143,BCDEGHIL,E,G,B,C,H,D,L,I
144,BCDEGHIK,E,G,B,C,H,D,I,K
145,BCDEGHIJ,H,G,B,C,J,D,E,I
146,BCDEFJKL,C,J,B,D,E,F,L,K
147,BCDEFIKL,C,E,B,D,I,F,L,K
148,BCDEFIJL,C,J,B,D,E,F,L,I
149,BCDEFIJK,C,J,B,D,E,F,I,K
150,BCDEFHKL,C,E,B,D,H,F,L,K
151,BCDEFHJL,C,J,B,D,H,F,L,E
152,BCDEFHJK,C,J,B,D,H,F,E,K
153,BCDEFHIL,C,E,B,D,H,F,L,I
154,BCDEFHIK,C,E,B,D,H,F,I,K
155,BCDEFHIJ,C,J,B,D,H,F,E,I
156,BCDEFGKL,C,G,B,D,E,F,L,K
157,BCDEFGJL,C,G,B,D,J,F,L,E
158,BCDEFGJK,C,G,B,D,J,F,E,K
159,BCDEFGIL,C,G,B,D,E,F,L,I
160,BCDEFGIK,C,G,B,D,E,F,I,K
161,BCDEFGIJ,C,G,B,D,J,F,E,I
162,BCDEFGHL,C,G,B,D,H,F,L,E
163,BCDEFGHK,C,G,B,D,H,F,E,K
164,BCDEFGHJ,H,G,B,C,J,F,D,E
165,BCDEFGHI,C,G,B,D,H,F,E,I
166,AFGHIJKL,H,J,I,F,A,G,L,K
167,AEGHIJKL,E,J,I,A,H,G,L,K
168,AEFHIJKL,E,J,I,F,A,H,L,K
169,AEFGIJKL,E,J,I,F,A,G,L,K
170,AEFGHJKL,E,G,J,F,A,H,L,K
171,AEFGHIKL,E,G,I,F,A,H,L,K
172,AEFGHIJL,E,G,J,F,A,H,L,I
173,AEFGHIJK,E,G,J,F,A,H,I,K
174,ADGHIJKL,H,J,I,D,A,G,L,K
175,ADFHIJKL,H,J,I,D,A,F,L,K
176,ADFGIJKL,I,G,J,D,A,F,L,K
177,ADFGHJKL,H,G,J,D,A,F,L,K
178,ADFGHIKL,H,G,I,D,A,F,L,K
179,ADFGHIJL,H,G,J,D,A,F,L,I
180,ADFGHIJK,H,G,J,D,A,F,I,K
181,ADEHIJKL,E,J,I,D,A,H,L,K
182,ADEGIJKL,E,J,I,D,A,G,L,K
183,ADEGHJKL,E,G,J,D,A,H,L,K
184,ADEGHIKL,E,G,I,D,A,H,L,K
185,ADEGHIJL,E,G,J,D,A,H,L,I
186,ADEGHIJK,E,G,J,D,A,H,I,K
187,ADEFIJKL,E,J,I,D,A,F,L,K
188,ADEFHJKL,H,J,E,D,A,F,L,K
189,ADEFHIKL,H,E,I,D,A,F,L,K
190,ADEFHIJL,H,J,E,D,A,F,L,I
191,ADEFHIJK,H,J,E,D,A,F,I,K
192,ADEFGJKL,E,G,J,D,A,F,L,K
193,ADEFGIKL,E,G,I,D,A,F,L,K
194,ADEFGIJL,E,G,J,D,A,F,L,I
195,ADEFGIJK,E,G,J,D,A,F,I,K
196,ADEFGHKL,H,G,E,D,A,F,L,K
197,ADEFGHJL,H,G,J,D,A,F,L,E
198,ADEFGHJK,H,G,J,D,A,F,E,K
199,ADEFGHIL,H,G,E,D,A,F,L,I
200,ADEFGHIK,H,G,E,D,A,F,I,K
201,ADEFGHIJ,H,G,J,D,A,F,E,I
202,ACGHIJKL,H,J,I,C,A,G,L,K
203,ACFHIJKL,H,J,I,C,A,F,L,K
204,ACFGIJKL,I,G,J,C,A,F,L,K
205,ACFGHJKL,H,G,J,C,A,F,L,K
206,ACFGHIKL,H,G,I,C,A,F,L,K
207,ACFGHIJL,H,G,J,C,A,F,L,I
208,ACFGHIJK,H,G,J,C,A,F,I,K
209,ACEHIJKL,E,J,I,C,A,H,L,K
210,ACEGIJKL,E,J,I,C,A,G,L,K
211,ACEGHJKL,E,G,J,C,A,H,L,K
212,ACEGHIKL,E,G,I,C,A,H,L,K
213,ACEGHIJL,E,G,J,C,A,H,L,I
214,ACEGHIJK,E,G,J,C,A,H,I,K
215,ACEFIJKL,E,J,I,C,A,F,L,K
216,ACEFHJKL,H,J,E,C,A,F,L,K
217,ACEFHIKL,H,E,I,C,A,F,L,K
218,ACEFHIJL,H,J,E,C,A,F,L,I
219,ACEFHIJK,H,J,E,C,A,F,I,K
220,ACEFGJKL,E,G,J,C,A,F,L,K
221,ACEFGIKL,E,G,I,C,A,F,L,K
222,ACEFGIJL,E,G,J,C,A,F,L,I
223,ACEFGIJK,E,G,J,C,A,F,I,K
224,ACEFGHKL,H,G,E,C,A,F,L,K
225,ACEFGHJL,H,G,J,C,A,F,L,E
226,ACEFGHJK,H,G,J,C,A,F,E,K
227,ACEFGHIL,H,G,E,C,A,F,L,I
228,ACEFGHIK,H,G,E,C,A,F,I,K
229,ACEFGHIJ,H,G,J,C,A,F,E,I
230,ACDHIJKL,H,J,I,C,A,D,L,K
231,ACDGIJKL,I,G,J,C,A,D,L,K
232,ACDGHJKL,H,G,J,C,A,D,L,K
233,ACDGHIKL,H,G,I,C,A,D,L,K
234,ACDGHIJL,H,G,J,C,A,D,L,I
235,ACDGHIJK,H,G,J,C,A,D,I,K
236,ACDFIJKL,C,J,I,D,A,F,L,K
237,ACDFHJKL,H,J,F,C,A,D,L,K
238,ACDFHIKL,H,F,I,C,A,D,L,K
239,ACDFHIJL,H,J,F,C,A,D,L,I
240,ACDFHIJK,H,J,F,C,A,D,I,K
241,ACDFGJKL,C,G,J,D,A,F,L,K
242,ACDFGIKL,C,G,I,D,A,F,L,K
243,ACDFGIJL,C,G,J,D,A,F,L,I
244,ACDFGIJK,C,G,J,D,A,F,I,K
245,ACDFGHKL,H,G,F,C,A,D,L,K
246,ACDFGHJL,C,G,J,D,A,F,L,H
247,ACDFGHJK,H,G,J,C,A,F,D,K
248,ACDFGHIL,H,G,F,C,A,D,L,I
249,ACDFGHIK,H,G,F,C,A,D,I,K
250,ACDFGHIJ,H,G,J,C,A,F,D,I
251,ACDEIJKL,E,J,I,C,A,D,L,K
252,ACDEHJKL,H,J,E,C,A,D,L,K
253,ACDEHIKL,H,E,I,C,A,D,L,K
254,ACDEHIJL,H,J,E,C,A,D,L,I
255,ACDEHIJK,H,J,E,C,A,D,I,K
256,ACDEGJKL,E,G,J,C,A,D,L,K
257,ACDEGIKL,E,G,I,C,A,D,L,K
258,ACDEGIJL,E,G,J,C,A,D,L,I
259,ACDEGIJK,E,G,J,C,A,D,I,K
260,ACDEGHKL,H,G,E,C,A,D,L,K
261,ACDEGHJL,H,G,J,C,A,D,L,E
262,ACDEGHJK,H,G,J,C,A,D,E,K
263,ACDEGHIL,H,G,E,C,A,D,L,I
264,ACDEGHIK,H,G,E,C,A,D,I,K
265,ACDEGHIJ,H,G,J,C,A,D,E,I
266,ACDEFJKL,C,J,E,D,A,F,L,K
267,ACDEFIKL,C,E,I,D,A,F,L,K
268,ACDEFIJL,C,J,E,D,A,F,L,I
269,ACDEFIJK,C,J,E,D,A,F,I,K
270,ACDEFHKL,H,E,F,C,A,D,L,K
271,ACDEFHJL,H,J,F,C,A,D,L,E
272,ACDEFHJK,H,J,E,C,A,F,D,K
273,ACDEFHIL,H,E,F,C,A,D,L,I
274,ACDEFHIK,H,E,F,C,A,D,I,K
275,ACDEFHIJ,H,J,E,C,A,F,D,I
276,ACDEFGKL,C,G,E,D,A,F,L,K
277,ACDEFGJL,C,G,J,D,A,F,L,E
278,ACDEFGJK,C,G,J,D,A,F,E,K
279,ACDEFGIL,C,G,E,D,A,F,L,I
280,ACDEFGIK,C,G,E,D,A,F,I,K
281,ACDEFGIJ,C,G,J,D,A,F,E,I
282,ACDEFGHL,H,G,F,C,A,D,L,E
283,ACDEFGHK,H,G,E,C,A,F,D,K
284,ACDEFGHJ,H,G,J,C,A,F,D,E
285,ACDEFGHI,H,G,E,C,A,F,D,I
286,ABGHIJKL,H,J,B,A,I,G,L,K
287,ABFHIJKL,H,J,B,A,I,F,L,K
288,ABFGIJKL,I,J,B,F,A,G,L,K
289,ABFGHJKL,H,J,B,F,A,G,L,K
290,ABFGHIKL,H,G,B,A,I,F,L,K
291,ABFGHIJL,H,J,B,F,A,G,L,I
292,ABFGHIJK,H,J,B,F,A,G,I,K
293,ABEHIJKL,E,J,B,A,I,H,L,K
294,ABEGIJKL,E,J,B,A,I,G,L,K
295,ABEGHJKL,E,J,B,A,H,G,L,K
296,ABEGHIKL,E,G,B,A,I,H,L,K
297,ABEGHIJL,E,J,B,A,H,G,L,I
298,ABEGHIJK,E,J,B,A,H,G,I,K
299,ABEFIJKL,E,J,B,A,I,F,L,K
300,ABEFHJKL,E,J,B,F,A,H,L,K
301,ABEFHIKL,E,I,B,F,A,H,L,K
302,ABEFHIJL,E,J,B,F,A,H,L,I
303,ABEFHIJK,E,J,B,F,A,H,I,K
304,ABEFGJKL,E,J,B,F,A,G,L,K
305,ABEFGIKL,E,G,B,A,I,F,L,K
306,ABEFGIJL,E,J,B,F,A,G,L,I
307,ABEFGIJK,E,J,B,F,A,G,I,K
308,ABEFGHKL,E,G,B,F,A,H,L,K
309,ABEFGHJL,H,J,B,F,A,G,L,E
310,ABEFGHJK,H,J,B,F,A,G,E,K
311,ABEFGHIL,E,G,B,F,A,H,L,I
312,ABEFGHIK,E,G,B,F,A,H,I,K
313,ABEFGHIJ,H,J,B,F,A,G,E,I
314,ABDHIJKL,I,J,B,D,A,H,L,K
315,ABDGIJKL,I,J,B,D,A,G,L,K
316,ABDGHJKL,H,J,B,D,A,G,L,K
317,ABDGHIKL,I,G,B,D,A,H,L,K
318,ABDGHIJL,H,J,B,D,A,G,L,I
319,ABDGHIJK,H,J,B,D,A,G,I,K
320,ABDFIJKL,I,J,B,D,A,F,L,K
321,ABDFHJKL,H,J,B,D,A,F,L,K
322,ABDFHIKL,H,I,B,D,A,F,L,K
323,ABDFHIJL,H,J,B,D,A,F,L,I
324,ABDFHIJK,H,J,B,D,A,F,I,K
325,ABDFGJKL,F,J,B,D,A,G,L,K
326,ABDFGIKL,I,G,B,D,A,F,L,K
327,ABDFGIJL,F,J,B,D,A,G,L,I
328,ABDFGIJK,F,J,B,D,A,G,I,K
329,ABDFGHKL,H,G,B,D,A,F,L,K
330,ABDFGHJL,H,G,B,D,A,F,L,J
331,ABDFGHJK,H,G,B,D,A,F,J,K
332,ABDFGHIL,H,G,B,D,A,F,L,I
333,ABDFGHIK,H,G,B,D,A,F,I,K
334,ABDFGHIJ,H,G,B,D,A,F,I,J
335,ABDEIJKL,E,J,B,A,I,D,L,K
336,ABDEHJKL,E,J,B,D,A,H,L,K
337,ABDEHIKL,E,I,B,D,A,H,L,K
338,ABDEHIJL,E,J,B,D,A,H,L,I
339,ABDEHIJK,E,J,B,D,A,H,I,K
340,ABDEGJKL,E,J,B,D,A,G,L,K
341,ABDEGIKL,E,G,B,A,I,D,L,K
342,ABDEGIJL,E,J,B,D,A,G,L,I
343,ABDEGIJK,E,J,B,D,A,G,I,K
344,ABDEGHKL,E,G,B,D,A,H,L,K
345,ABDEGHJL,H,J,B,D,A,G,L,E
346,ABDEGHJK,H,J,B,D,A,G,E,K
347,ABDEGHIL,E,G,B,D,A,H,L,I
348,ABDEGHIK,E,G,B,D,A,H,I,K
349,ABDEGHIJ,H,J,B,D,A,G,E,I
350,ABDEFJKL,E,J,B,D,A,F,L,K
351,ABDEFIKL,E,I,B,D,A,F,L,K
352,ABDEFIJL,E,J,B,D,A,F,L,I
353,ABDEFIJK,E,J,B,D,A,F,I,K
354,ABDEFHKL,H,E,B,D,A,F,L,K
355,ABDEFHJL,H,J,B,D,A,F,L,E
356,ABDEFHJK,H,J,B,D,A,F,E,K
357,ABDEFHIL,H,E,B,D,A,F,L,I
358,ABDEFHIK,H,E,B,D,A,F,I,K
359,ABDEFHIJ,H,J,B,D,A,F,E,I
360,ABDEFGKL,E,G,B,D,A,F,L,K
361,ABDEFGJL,E,G,B,D,A,F,L,J
362,ABDEFGJK,E,G,B,D,A,F,J,K
363,ABDEFGIL,E,G,B,D,A,F,L,I
364,ABDEFGIK,E,G,B,D,A,F,I,K
365,ABDEFGIJ,E,G,B,D,A,F,I,J
366,ABDEFGHL,H,G,B,D,A,F,L,E
367,ABDEFGHK,H,G,B,D,A,F,E,K
368,ABDEFGHJ,H,G,B,D,A,F,E,J
369,ABDEFGHI,H,G,B,D,A,F,E,I
370,ABCHIJKL,I,J,B,C,A,H,L,K
371,ABCGIJKL,I,J,B,C,A,G,L,K
372,ABCGHJKL,H,J,B,C,A,G,L,K
373,ABCGHIKL,I,G,B,C,A,H,L,K
374,ABCGHIJL,H,J,B,C,A,G,L,I
375,ABCGHIJK,H,J,B,C,A,G,I,K
376,ABCFIJKL,I,J,B,C,A,F,L,K
377,ABCFHJKL,H,J,B,C,A,F,L,K
378,ABCFHIKL,H,I,B,C,A,F,L,K
379,ABCFHIJL,H,J,B,C,A,F,L,I
380,ABCFHIJK,H,J,B,C,A,F,I,K
381,ABCFGJKL,C,J,B,F,A,G,L,K
382,ABCFGIKL,I,G,B,C,A,F,L,K
383,ABCFGIJL,C,J,B,F,A,G,L,I
384,ABCFGIJK,C,J,B,F,A,G,I,K
385,ABCFGHKL,H,G,B,C,A,F,L,K
386,ABCFGHJL,H,G,B,C,A,F,L,J
387,ABCFGHJK,H,G,B,C,A,F,J,K
388,ABCFGHIL,H,G,B,C,A,F,L,I
389,ABCFGHIK,H,G,B,C,A,F,I,K
390,ABCFGHIJ,H,G,B,C,A,F,I,J
391,ABCEIJKL,E,J,B,A,I,C,L,K
392,ABCEHJKL,E,J,B,C,A,H,L,K
393,ABCEHIKL,E,I,B,C,A,H,L,K
394,ABCEHIJL,E,J,B,C,A,H,L,I
395,ABCEHIJK,E,J,B,C,A,H,I,K
396,ABCEGJKL,E,J,B,C,A,G,L,K
397,ABCEGIKL,E,G,B,A,I,C,L,K
398,ABCEGIJL,E,J,B,C,A,G,L,I
399,ABCEGIJK,E,J,B,C,A,G,I,K
400,ABCEGHKL,E,G,B,C,A,H,L,K
401,ABCEGHJL,H,J,B,C,A,G,L,E
402,ABCEGHJK,H,J,B,C,A,G,E,K
403,ABCEGHIL,E,G,B,C,A,H,L,I
404,ABCEGHIK,E,G,B,C,A,H,I,K
405,ABCEGHIJ,H,J,B,C,A,G,E,I
406,ABCEFJKL,E,J,B,C,A,F,L,K
407,ABCEFIKL,E,I,B,C,A,F,L,K
408,ABCEFIJL,E,J,B,C,A,F,L,I
409,ABCEFIJK,E,J,B,C,A,F,I,K
410,ABCEFHKL,H,E,B,C,A,F,L,K
411,ABCEFHJL,H,J,B,C,A,F,L,E
412,ABCEFHJK,H,J,B,C,A,F,E,K
413,ABCEFHIL,H,E,B,C,A,F,L,I
414,ABCEFHIK,H,E,B,C,A,F,I,K
415,ABCEFHIJ,H,J,B,C,A,F,E,I
416,ABCEFGKL,E,G,B,C,A,F,L,K
417,ABCEFGJL,E,G,B,C,A,F,L,J
418,ABCEFGJK,E,G,B,C,A,F,J,K
419,ABCEFGIL,E,G,B,C,A,F,L,I
420,ABCEFGIK,E,G,B,C,A,F,I,K
421,ABCEFGIJ,E,G,B,C,A,F,I,J
422,ABCEFGHL,H,G,B,C,A,F,L,E
423,ABCEFGHK,H,G,B,C,A,F,E,K
424,ABCEFGHJ,H,G,B,C,A,F,E,J
425,ABCEFGHI,H,G,B,C,A,F,E,I
426,ABCDIJKL,I,J,B,C,A,D,L,K
427,ABCDHJKL,H,J,B,C,A,D,L,K
428,ABCDHIKL,H,I,B,C,A,D,L,K
429,ABCDHIJL,H,J,B,C,A,D,L,I
430,ABCDHIJK,H,J,B,C,A,D,I,K
431,ABCDGJKL,C,J,B,D,A,G,L,K
432,ABCDGIKL,I,G,B,C,A,D,L,K
433,ABCDGIJL,C,J,B,D,A,G,L,I
434,ABCDGIJK,C,J,B,D,A,G,I,K
435,ABCDGHKL,H,G,B,C,A,D,L,K
436,ABCDGHJL,H,G,B,C,A,D,L,J
437,ABCDGHJK,H,G,B,C,A,D,J,K
438,ABCDGHIL,H,G,B,C,A,D,L,I
439,ABCDGHIK,H,G,B,C,A,D,I,K
440,ABCDGHIJ,H,G,B,C,A,D,I,J
441,ABCDFJKL,C,J,B,D,A,F,L,K
442,ABCDFIKL,C,I,B,D,A,F,L,K
443,ABCDFIJL,C,J,B,D,A,F,L,I
444,ABCDFIJK,C,J,B,D,A,F,I,K
445,ABCDFHKL,H,F,B,C,A,D,L,K
446,ABCDFHJL,C,J,B,D,A,F,L,H
447,ABCDFHJK,H,J,B,C,A,F,D,K
448,ABCDFHIL,H,F,B,C,A,D,L,I
449,ABCDFHIK,H,F,B,C,A,D,I,K
450,ABCDFHIJ,H,J,B,C,A,F,D,I
451,ABCDFGKL,C,G,B,D,A,F,L,K
452,ABCDFGJL,C,G,B,D,A,F,L,J
453,ABCDFGJK,C,G,B,D,A,F,J,K
454,ABCDFGIL,C,G,B,D,A,F,L,I
455,ABCDFGIK,C,G,B,D,A,F,I,K
456,ABCDFGIJ,C,G,B,D,A,F,I,J
457,ABCDFGHL,C,G,B,D,A,F,L,H
458,ABCDFGHK,H,G,B,C,A,F,D,K
459,ABCDFGHJ,H,G,B,C,A,F,D,J
460,ABCDFGHI,H,G,B,C,A,F,D,I
461,ABCDEJKL,E,J,B,C,A,D,L,K
462,ABCDEIKL,E,I,B,C,A,D,L,K
463,ABCDEIJL,E,J,B,C,A,D,L,I
464,ABCDEIJK,E,J,B,C,A,D,I,K
465,ABCDEHKL,H,E,B,C,A,D,L,K
466,ABCDEHJL,H,J,B,C,A,D,L,E
467,ABCDEHJK,H,J,B,C,A,D,E,K
468,ABCDEHIL,H,E,B,C,A,D,L,I
469,ABCDEHIK,H,E,B,C,A,D,I,K
470,ABCDEHIJ,H,J,B,C,A,D,E,I
471,ABCDEGKL,E,G,B,C,A,D,L,K
472,ABCDEGJL,E,G,B,C,A,D,L,J
473,ABCDEGJK,E,G,B,C,A,D,J,K
474,ABCDEGIL,E,G,B,C,A,D,L,I
475,ABCDEGIK,E,G,B,C,A,D,I,K
476,ABCDEGIJ,E,G,B,C,A,D,I,J
477,ABCDEGHL,H,G,B,C,A,D,L,E
478,ABCDEGHK,H,G,B,C,A,D,E,K
479,ABCDEGHJ,H,G,B,C,A,D,E,J
480,ABCDEGHI,H,G,B,C,A,D,E,I
481,ABCDEFKL,C,E,B,D,A,F,L,K
482,ABCDEFJL,C,J,B,D,A,F,L,E
483,ABCDEFJK,C,J,B,D,A,F,E,K
484,ABCDEFIL,C,E,B,D,A,F,L,I
485,ABCDEFIK,C,E,B,D,A,F,I,K
486,ABCDEFIJ,C,J,B,D,A,F,E,I
487,ABCDEFHL,H,F,B,C,A,D,L,E
488,ABCDEFHK,H,E,B,C,A,F,D,K
489,ABCDEFHJ,H,J,B,C,A,F,D,E
490,ABCDEFHI,H,E,B,C,A,F,D,I
491,ABCDEFGL,C,G,B,D,A,F,L,E
492,ABCDEFGK,C,G,B,D,A,F,E,K
493,ABCDEFGJ,C,G,B,D,A,F,E,J
494,ABCDEFGI,C,G,B,D,A,F,E,I
495,ABCDEFGH,H,G,B,C,A,F,D,E
```
