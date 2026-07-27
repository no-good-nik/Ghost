const {recreateTable} = require('../../utils');

// Repoint a member's stored value at the field's immutable `key` rather than its
// internal `id`. The key is the identity everything else already uses — the API,
// CSV columns, and now segment filters — so referencing it directly lets a filter
// query by key with no id lookup, and keeps the value's foreign key in the same
// vocabulary as the rest of the feature. Safe as a foreign key because the key is
// unique and never changes once minted.
//
// A recreate (drop + rebuild) rather than an in-place column swap: SQLite can't
// alter a foreign key without rebuilding the table anyway, and the feature is
// behind the membersCustomFields flag and not yet in production, so there are no
// stored values to preserve.
module.exports = recreateTable('members_custom_field_values', {
    id: {type: 'string', maxlength: 24, nullable: false, primary: true},
    custom_field_key: {type: 'string', maxlength: 191, nullable: false, references: 'members_custom_fields.key', cascadeDelete: true},
    member_id: {type: 'string', maxlength: 24, nullable: false, references: 'members.id', cascadeDelete: true},
    value_text: {type: 'text', maxlength: 65535, nullable: true},
    value_json: {type: 'text', maxlength: 65535, nullable: true},
    created_at: {type: 'dateTime', nullable: false},
    updated_at: {type: 'dateTime', nullable: true},
    '@@UNIQUE_CONSTRAINTS@@': [
        ['member_id', 'custom_field_key']
    ]
});
