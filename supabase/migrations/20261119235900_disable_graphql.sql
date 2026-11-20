-- ADR 0001: published objects are read over RPC through PostgREST only.
-- GraphQL stays off so there is one API to secure and one set of generated types.
-- `graphql_public` is also left out of the exposed schemas in config.toml; on the
-- hosted project, remove it from Settings > API > Exposed schemas by hand.
drop extension if exists pg_graphql;
