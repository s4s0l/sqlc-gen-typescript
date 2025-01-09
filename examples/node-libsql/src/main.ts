import { createClient, type Client } from "@libsql/client";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  createAuthor,
  deleteAuthor,
  getAuthor,
  listAuthors,
} from "./db/query_sql";

interface Author {
  id: string;
  name: string;
  bio: string | null;
}

async function main() {
  const ddl = await readFile(
    join(__dirname, "../../authors/sqlite/schema.sql"),
    { encoding: "utf-8" }
  );
  const database = createClient({
    url: ":memory:",
  });

  // Create tables
  await database.execute(ddl);

  // Create an author
  await createAuthor(database, {
    name: "Seal",
    bio: "Kissed from a rose",
  });

  // List the authors
  const authors = await listAuthors(database);
  console.log(authors);

  // Get that author
  const seal = await getAuthor(database, { id: authors[0].id });
  if (seal === null) {
    throw new Error("seal not found");
  }
  console.log(seal);

  // Delete the author
  const deleted = await deleteAuthor(database, { id: seal.id });
  if (deleted !== 1) {
    throw new Error("seal not deleted");
  }

  const noAuthors = await listAuthors(database);
  console.log(noAuthors);
  if (noAuthors.length !== 0) {
    throw new Error("expected no authors");
  }

  const missingAuthor = await getAuthor(database, { id: seal.id });
  if (missingAuthor !== null) {
    throw new Error("expected missing author");
  }
  console.log("seems fine");
}

(async () => {
  try {
    await main();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
