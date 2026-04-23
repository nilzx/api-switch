"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

async function readJsonObject(filePath, label) {
  const content = await fs.readFile(filePath, "utf8");
  let data;

  try {
    data = JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON in ${filePath}.`);
  }

  if (!isPlainObject(data)) {
    throw new Error(`${label} root must be a JSON object.`);
  }

  return data;
}

async function readOrCreateJsonObject(filePath, label) {
  try {
    return await readJsonObject(filePath, label);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

module.exports = {
  isPlainObject,
  readJsonObject,
  readOrCreateJsonObject,
  writeJson
};
