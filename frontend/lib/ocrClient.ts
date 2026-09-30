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
  let year = "";

  // 1. College extraction (check top 5 lines and multi-line names like "UNIVERSITY OF" + "OXFORD")
  const collegeKeywords = [
    "HERITAGE", "COLLEGE", "UNIVERSITY", "INSTITUTE", "ACADEMY", "SCHOOL",
    "VIDYALAYA", "CAMPUS", "TECHNOLOGY", "FACULTY", "POLYTECHNIC", "ENGINEERING"
  ];

  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    const upper = line.toUpperCase();
    if (collegeKeywords.some((kw) => upper.includes(kw))) {
      let rawCollege = line.replace(/^[.:\-_#=\s]+|[.:\-_#=\s]+$/g, "");
      // Check if next line is continuation of college name (e.g. "UNIVERSITY OF" + "OXFORD" or "HERITAGE INSTITUTE OF" + "TECHNOLOGY")
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const nextUpper = nextLine.toUpperCase();
        if (
          !nextUpper.includes("ID CARD") &&
          !nextUpper.includes("STUDENT") &&
          !nextUpper.includes("NAME") &&
          !nextUpper.includes("COURSE") &&
          !nextUpper.includes("AFFILIATED") &&
          !nextUpper.includes("RECOGNISED") &&
          !nextUpper.includes("DECLARED") &&
          nextLine.length >= 2 &&
          nextLine.length <= 40 &&
          !nextUpper.includes(":")
        ) {
          if (upper.endsWith("OF") || upper.endsWith("FOR") || upper.endsWith("&") || upper.endsWith("AT") || rawCollege.split(" ").length <= 2) {
            rawCollege += " " + nextLine;
          }
        }
      }
      college = rawCollege;
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
      const mId = line.match(/(?:ROLL\s*(?:NO|NUMBER|\.)*|STUDENT\s*ID\s*(?:NO|NUMBER|\.)*|REG(?:ISTRATION)?\s*(?:NO|ID|\.)*|ADM(?:ISSION)?\s*(?:NO|ID|\.)*|ENROLLMENT\s*(?:NO|ID|\.)*|ID\s*(?:NO|NUMBER|NUM|#|\.)*\s*(?!CARD))\s*[:#=-]?\s*([A-Z0-9\/-]{1,20})/i);
      if (mId && mId[1].trim()) {
        const val = mId[1].trim();
        const upperVal = val.toUpperCase();
        if (!["CARD", "IDENTITY", "STUDENT", "VALID", "NO", "NUM", "NUMBER", "ID"].includes(upperVal)) {
          student_id = val;
        }
      }
    }

    // Stream / Course / Class / Branch
    if (!stream) {
      const mStream = line.match(/^(?:CLASS|STREAM|COURSE|BRANCH|DEPT|DEPARTMENT|PROGRAM)\s*[:#=-]?\s*(.+)$/i);
      if (mStream && mStream[1].trim()) {
        const val = mStream[1].trim();
        if (!["CARD", "IDENTITY", "STUDENT"].some((k) => val.toUpperCase().includes(k))) {
          stream = val;
        }
      }
    }

    // Year / Batch (e.g. 2024 - 2028 or 1st/2nd/3rd Year)
    if (!year) {
      const mBatch = line.match(/\b(202[0-9])\s*[-–]\s*(202[0-9])\b/);
      if (mBatch) {
        const startYr = parseInt(mBatch[1], 10);
        const currentYr = new Date().getFullYear(); // e.g. 2026
        const calcYear = currentYr - startYr + 1;
        if (calcYear === 1) year = "1st";
        else if (calcYear === 2) year = "2nd";
        else if (calcYear === 3) year = "3rd";
        else if (calcYear === 4) year = "4th";
        else year = "1st";
      } else {
        const mYear = line.match(/\b(1ST|2ND|3RD|4TH|5TH|FIRST|SECOND|THIRD|FOURTH|FINAL)\s*(?:YEAR|YR|SEM)?\b/i);
        if (mYear) {
          const yMap: Record<string, string> = {
            "1ST": "1st", "2ND": "2nd", "3RD": "3rd", "4TH": "4th", "5TH": "5th",
            "FIRST": "1st", "SECOND": "2nd", "THIRD": "3rd", "FOURTH": "4th", "FINAL": "4th",
          };
          year = yMap[mYear[1].toUpperCase()] || "1st";
        }
      }
    }
  }

  // 3. Fallback for unlabeled Name: standalone capitalized line (2-4 words, e.g. RITIKA SEN)
  if (!name) {
    const excludeWords = new Set([
      "ID", "CARD", "STUDENT", "IDENTITY", "COLLEGE", "UNIVERSITY", "SCHOOL",
      "ACADEMY", "INSTITUTE", "DOB", "DATE", "BLOOD", "MOBILE", "PHONE", "ROLL",
      "REGISTRATION", "ADDRESS", "VALID", "UPTO", "PRINCIPAL", "SIGNATURE",
      "AFFILIATED", "RECOGNISED", "GOVT", "JAMMU", "STATE", "FATHER", "FATHER'S", "MOTHER",
      "AUTONOMOUS", "DECLARED", "TEL", "EMAIL", "FAX"
    ]);

    for (let i = 0; i < Math.min(lines.length, 12); i++) {
      const line = lines[i];
      const upper = line.toUpperCase();
      if (upper.includes("FATHER") || upper.includes("MOTHER") || upper.includes("VALID") || upper.includes("TEL:")) continue;

      const words = line.split(/\s+/);
      if (words.length >= 2 && words.length <= 4 && !/\d/.test(line)) {
        if (!words.some((w) => excludeWords.has(w.toUpperCase()))) {
          name = line;
          break;
        }
      }
    }
  }

  // 4. Fallback for Stream keywords (e.g. B.TECH - CSE(Data Science))
  if (!stream) {
    const streamKeywords = [
      "B.TECH", "BTECH", "B.E", "BE", "M.TECH", "CSE", "ECE", "DATA SCIENCE",
      "MBBS", "BBA", "BCA", "B.SC", "BSC", "MBA", "B.COM", "BCOM",
      "COMPUTER SCIENCE", "MECHANICAL", "CIVIL"
    ];
    for (const line of lines) {
      const upper = line.toUpperCase();
      if (["ID CARD", "IDENTITY"].some((k) => upper.includes(k))) continue;
      if (streamKeywords.some((kw) => upper.includes(kw))) {
        // Clean line to make a nice course name
        let s = line.replace(/^(?:STUDENT|CLASS|STREAM|COURSE|BRANCH|DEPT|DEPARTMENT)\s*[:#=-]?\s*/i, "");
        if (s.length >= 2 && s.length <= 45) {
          stream = s;
          break;
        }
      }
    }
  }

  const toTitle = (str: string) =>
    str
      .toLowerCase()
      .replace(/\b[a-z]/g, (c) => c.toUpperCase());

  return {
    student_id: student_id ? student_id.replace(/^[:#=\s.-]+/, "") : "",
    name: name ? toTitle(name) : "",
    college: college ? toTitle(college) : "",
    stream: stream ? stream.replace(/^[:#=\s.-]+/, "") : "",
    year: year || "1st",
  };
}
