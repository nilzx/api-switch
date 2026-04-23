"use strict";

function setTomlAssignment(content, sectionPath, key, rawValue) {
  const lines = splitLines(content);
  const normalizedSectionPath = normalizeSectionPath(sectionPath);
  const nextContent = upsertAssignment(lines, normalizedSectionPath, key, rawValue).join("\n");
  return ensureTrailingNewline(nextContent);
}

function removeTomlAssignment(content, sectionPath, key) {
  const lines = splitLines(content);
  const normalizedSectionPath = normalizeSectionPath(sectionPath);
  const nextContent = removeAssignment(lines, normalizedSectionPath, key).join("\n");
  return ensureTrailingNewline(compactBlankLines(nextContent));
}

function splitLines(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  return normalized === "" ? [] : normalized.split("\n");
}

function upsertAssignment(lines, sectionPath, key, rawValue) {
  const range = findSectionRange(lines, sectionPath);
  const assignmentLine = `${key} = ${rawValue}`;

  if (range.exists) {
    const keyIndex = findAssignmentIndex(lines, range.start, range.end, key);
    if (keyIndex !== -1) {
      lines[keyIndex] = assignmentLine;
      return lines;
    }

    lines.splice(range.end, 0, assignmentLine);
    return lines;
  }

  if (sectionPath.length === 0) {
    const insertIndex = findTopLevelInsertIndex(lines);
    lines.splice(insertIndex, 0, assignmentLine);
    return lines;
  }

  if (lines.length > 0 && lines[lines.length - 1] !== "") {
    lines.push("");
  }

  lines.push(`[${sectionPath.join(".")}]`);
  lines.push(assignmentLine);
  return lines;
}

function removeAssignment(lines, sectionPath, key) {
  const range = findSectionRange(lines, sectionPath);
  if (!range.exists) {
    return lines;
  }

  const keyIndex = findAssignmentIndex(lines, range.start, range.end, key);
  if (keyIndex !== -1) {
    lines.splice(keyIndex, 1);
  }

  return removeEmptySection(lines, sectionPath);
}

function removeEmptySection(lines, sectionPath) {
  if (sectionPath.length === 0) {
    return lines;
  }

  const range = findSectionRange(lines, sectionPath);
  if (!range.exists) {
    return lines;
  }

  for (let index = range.start; index < range.end; index += 1) {
    if (isMeaningfulLine(lines[index])) {
      return lines;
    }
  }

  const deleteStart = trimLeadingBlankLines(lines, range.headerIndex);
  let deleteEnd = range.end;
  while (deleteEnd < lines.length && lines[deleteEnd] === "") {
    deleteEnd += 1;
  }
  lines.splice(deleteStart, deleteEnd - deleteStart);
  return lines;
}

function trimLeadingBlankLines(lines, index) {
  let current = index;
  while (current > 0 && lines[current - 1] === "") {
    current -= 1;
  }
  return current;
}

function findTopLevelInsertIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    if (isSectionHeader(lines[index])) {
      return index;
    }
  }
  return lines.length;
}

function findAssignmentIndex(lines, start, end, key) {
  const matcher = new RegExp(`^${escapeRegExp(key)}\\s*=`);
  for (let index = start; index < end; index += 1) {
    if (matcher.test(lines[index].trim())) {
      return index;
    }
  }
  return -1;
}

function findSectionRange(lines, sectionPath) {
  if (sectionPath.length === 0) {
    const firstHeaderIndex = lines.findIndex((line) => isSectionHeader(line));
    return {
      exists: true,
      headerIndex: -1,
      start: 0,
      end: firstHeaderIndex === -1 ? lines.length : firstHeaderIndex
    };
  }

  const sectionName = sectionPath.join(".");

  for (let index = 0; index < lines.length; index += 1) {
    const parsed = parseSectionHeader(lines[index]);
    if (!parsed || parsed.type !== "single") {
      continue;
    }

    if (parsed.name !== sectionName) {
      continue;
    }

    let end = index + 1;
    while (end < lines.length && !isSectionHeader(lines[end])) {
      end += 1;
    }

    return {
      exists: true,
      headerIndex: index,
      start: index + 1,
      end
    };
  }

  return {
    exists: false,
    headerIndex: -1,
    start: lines.length,
    end: lines.length
  };
}

function parseSectionHeader(line) {
  const trimmed = line.trim();
  let match = /^\[([^\[\]]+)\]$/.exec(trimmed);
  if (match) {
    return {
      type: "single",
      name: match[1].trim()
    };
  }

  match = /^\[\[([^\[\]]+)\]\]$/.exec(trimmed);
  if (match) {
    return {
      type: "array",
      name: match[1].trim()
    };
  }

  return null;
}

function isSectionHeader(line) {
  return parseSectionHeader(line) !== null;
}

function isMeaningfulLine(line) {
  const trimmed = line.trim();
  return trimmed !== "" && !trimmed.startsWith("#");
}

function normalizeSectionPath(sectionPath) {
  if (Array.isArray(sectionPath)) {
    return sectionPath;
  }

  if (!sectionPath) {
    return [];
  }

  return String(sectionPath).split(".").filter(Boolean);
}

function ensureTrailingNewline(content) {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function compactBlankLines(content) {
  return content.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "");
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  removeTomlAssignment,
  setTomlAssignment
};
