import {mapQuery} from '@tryghost/mongo-utils';

// The members filter reaches custom field values through a `custom_fields`
// relation on the Member model (the values table joined on member_id). A field is
// named by its `key` — a value in the filter, so hyphens and the rest need no
// escaping — and matched on its `value`:
//
//   (custom_fields.key:'company'+custom_fields.value:'Ghost')
//   (custom_fields.key:'shipping-address'+custom_fields.value.country:'GB')
//   custom_fields.key:'phone'                      // is set
//   custom_fields.key:-'phone'                     // is not set
//
// `key`/`value` are the stable public vocabulary; the table's real columns
// (custom_field_key, value_text, value_json) are storage detail that must not leak
// into a saved segment. This transformer maps the public names onto the columns
// just before the query is built, so the storage split — text in its own column, a
// composite address as a JSON blob queried by path — stays invisible to the client.
const RELATION = 'custom_fields';
const PREFIX = `${RELATION}.`;

// A bare `value` is the scalar (text) column; `value.<subfield>` is a path into the
// address JSON. Which column a predicate lands on is decided by whether it carries
// a sub-path, not by looking up the field's type — the filter's shape already says.
function aliasColumn(attribute: string): string | null {
    const [head, ...path] = attribute.split('.');

    if (head === 'key' && path.length === 0) {
        return 'custom_field_key';
    }
    if (head === 'value') {
        return path.length === 0 ? 'value_text' : `value_json.${path.join('.')}`;
    }
    return null;
}

/**
 * A synchronous mongoTransformer that rewrites the public `custom_fields.key` /
 * `custom_fields.value[.subfield]` filter keys onto the relation's real columns.
 * Keys it doesn't recognise are left untouched for the normal filter path to
 * reject. Cheap and pure — no database access — because the `custom_fields`
 * relation and mongo-knex's JSON-path support do the actual querying.
 */
export function customFieldsFilterTransformer(query: object): object {
    return mapQuery(query, (value: unknown, key: string) => {
        if (!key.startsWith(PREFIX)) {
            return {[key]: value};
        }
        const column = aliasColumn(key.slice(PREFIX.length));
        return column ? {[`${PREFIX}${column}`]: value} : {[key]: value};
    });
}

/**
 * The Member filter relation that exposes custom field values. A member has many
 * value rows (one per field), and a predicate asks whether any of them matches, so
 * this joins the values table on member_id and mongo-knex emits it as a correlated
 * `members.id IN (…)` subquery — composing with every other member filter.
 */
export const CUSTOM_FIELDS_RELATION = {
    tableName: 'members_custom_field_values',
    tableNameAs: RELATION,
    type: 'oneToOne',
    joinFrom: 'member_id'
} as const;
