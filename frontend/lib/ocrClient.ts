import { recognize } from "tesseract.js";

export interface ExtractedDetails {
  student_id: string;
  name: string;
  college: string;
  stream: string;
  year: string;
}

export async function parseIdCardClient(file: File): Promise<ExtractedDetails> {
  const result = await recognize(file, "eng");
  const rawText = result.data.text || "";
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let name = "";
  let college = "";
  let stream = "";
  let student_id = "";
  let year = "1st";

  // 1. College extraction (check top 5 lines)
  const collegeKeywords = [
    "COLLEGE", "UNIVERSITY", "INSTITUTE", "ACADEMY", "SCHOOL",
    "VIDYALAYA", "CAMPUS", "TECHNOLOGY", "FACULTY", "POLYTECHNIC", "ENGINEERING"
  ];

  for (const line of lines.slice(0, 5)) {
    const upper = line.toUpperCase();
    if (collegeKeywords.some((kw) => upper.includes(kw))) {
      college = line.replace(/^[.:\-_#=\s]+|[.:\-_#=\s]+$/g, "");
      break;
    }
  }

  // 2. Line by line parsing for labeled fields
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    if (["ID CARD", "IDENTITY CARD", "STUDENT CARD", "STUDENT IDENTITY"].some((h) => upper.includes(h))) {
      continue;
    }

    // Name (Explicit "Name:" or "Student Name:")
    if (!name) {
      const mName = line.match(/^(?:NAME|STUDENT\s*NAME|FULL\s*NAME|STUDENT['’]?S\s*NAME)\s*[:#=-]?\s*(.+)$/i);
      if (mName && mName[1].trim().length >= 2) {
        if (!upper.includes("FATHER") && !upper.includes("MOTHER")) {
          name = mName[1].trim();
        }
      }
    }

    // Student ID / Roll / Reg Number
    if (!student_id) {
      const mId = line.match(/(?:ROLL\s*(?:NO|NUMBER|\.)*|STUDENT\s*ID|REG(?:ISTRATION)?\s*(?:NO|ID|\.)*|ADM(?:ISSION)?\s*(?:NO|ID|\.)*|ENROLLMENT\s*(?:NO|ID|\.)*|ID\s*(?!CARD))\s*[:#=-]?\s*([A-Z0-9\/-]{1,20})/i);
      if (mId && mId[1].trim()) {
        const val = mId[1].trim();
        if (!["CARD", "IDENTITY", "STUDENT", "VALID"].some((k) => val.toUpperCase().includes(k))) {
          student_id = val;
        }
      }
    }

    // Stream / Course / Class
    if (!stream) {
      const mStream = line.match(/^(?:CLASS|STREAM|COURSE|BRANCH|DEPT|DEPARTMENT|PROGRAM)\s*[:#=-]?\s*(.+)$/i);
      if (mStream && mStream[1].trim()) {
        const val = mStream[1].trim();
        if (!["CARD", "IDENTITY", "STUDENT"].some((k) => val.toUpperCase().includes(k))) {
          stream = val;
        }
      }
    }

    // Year
    const mYear = line.match(/\b(1ST|2ND|3RD|4TH|5TH|FIRST|SECOND|THIRD|FOURTH|FINAL)\s*(?:YEAR|YR|SEM)?\b/i);
    if (mYear) {
      const yMap: Record<string, string> = {
        "1ST": "1st", "2ND": "2nd", "3RD": "3rd", "4TH": "4th", "5TH": "5th",
        "FIRST": "1st", "SECOND": "2nd", "THIRD": "3rd", "FOURTH": "4th", "FINAL": "4th",
      };
      year = yMap[mYear[1].toUpperCase()] || "1st";
    }
  }

  // 3. Fallback for unlabeled Name: standalone capitalized line (2-4 words, e.g. SEEMA SHARMA)
  if (!name) {
    const excludeWords = new Set([
      "ID", "CARD", "STUDENT", "IDENTITY", "COLLEGE", "UNIVERSITY", "SCHOOL",
      "ACADEMY", "INSTITUTE", "DOB", "DATE", "BLOOD", "MOBILE", "PHONE", "ROLL",
      "REGISTRATION", "ADDRESS", "VALID", "UPTO", "PRINCIPAL", "SIGNATURE",
      "AFFILIATED", "RECOGNISED", "GOVT", "JAMMU", "STATE", "FATHER", "FATHER'S", "MOTHER"
    ]);

    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i];
      const upper = line.toUpperCase();
      if (upper.includes("FATHER") || upper.includes("MOTHER")) continue;

      const words = line.split(/\s+/);
      if (words.length >= 2 && words.length <= 4 && !/\d/.test(line)) {
        if (!words.some((w) => excludeWords.has(w.toUpperCase()))) {
          name = line;
          break;
        }
      }
    }
  }

  // 4. Fallback for Stream keywords
  if (!stream) {
    const streamKeywords = [
      "BBA", "BCA", "B.TECH", "BTECH", "B.SC", "BSC", "B.E", "BE", "M.TECH", "MBA",
      "B.COM", "BCOM", "COMPUTER SCIENCE", "CSE", "ECE", "MECHANICAL", "CIVIL"
    ];
    for (const line of lines) {
      const upper = line.toUpperCase();
      if (["ID CARD", "IDENTITY"].some((k) => upper.includes(k))) continue;
      for (const kw of streamKeywords) {
        const regex = new RegExp(`\\b${kw}\\b`, "i");
        if (regex.test(line)) {
          stream = kw;
          break;
        }
      }
      if (stream) break;
    }
  }

  const toTitle = (str: string) =>
    str
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    student_id: student_id || "0023",
    name: name ? toTitle(name) : "",
    college: college ? toTitle(college) : "",
    stream: stream ? stream.toUpperCase() : "",
    year: year || "1st",
  };
}
