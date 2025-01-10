-- name: GetAuthor :one
SELECT *
FROM authors
WHERE id = ?
LIMIT 1;
-- name: ListAuthors :many
SELECT *
FROM authors
ORDER BY name;
-- name: CreateAuthor :exec
INSERT INTO authors (name, bio_graphyitis)
VALUES (?, ?);
-- name: DeleteAuthor :exec
DELETE FROM authors
WHERE id = ?;