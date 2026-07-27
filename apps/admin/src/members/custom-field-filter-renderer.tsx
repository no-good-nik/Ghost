import React from 'react';
import {CUSTOM_FIELD_OPERATOR_LABELS, operatorsForCustomFieldType} from './member-fields';
import {FilterSegmentInput, FilterSegmentSelect} from '@tryghost/shade/patterns';
import {useBrowseMemberCustomFields} from '@tryghost/admin-x-framework/api/member-custom-fields';
import type {CustomRendererProps} from '@tryghost/shade/patterns';

// One "Custom field" filter stands in for every defined field, so its value area
// is a cascade of native filter segments: which field, then (for an address) which
// sub-field, then the operator, then the value. The operator lives here because its
// valid set depends on the field's type, which is chosen here. Segments are composed
// from the framework's own primitives so they read as one pill with the other
// filters. The predicate carries the value selections as [fieldKey, subfield, value]
// (the shape member-fields.ts serialises to compound NQL); the operator stays the
// predicate's own operator, driven through onOperatorChange.
const ADDRESS_SUBFIELDS: Array<{value: string; label: string}> = [
    {value: 'line1', label: 'Address line 1'},
    {value: 'line2', label: 'Address line 2'},
    {value: 'city', label: 'City'},
    {value: 'state', label: 'State'},
    {value: 'postal_code', label: 'Postal code'},
    {value: 'country', label: 'Country'}
];

const VALUELESS_OPERATORS = new Set(['is-set', 'is-not-set']);

const CustomFieldFilterRenderer: React.FC<CustomRendererProps<string>> = ({values, onChange, operator, onOperatorChange}) => {
    const {data} = useBrowseMemberCustomFields();
    const fields = data?.members_custom_fields ?? [];

    const [fieldKey = '', subfield = '', value = ''] = values;
    const selectedField = fields.find(field => field.key === fieldKey);
    const isAddress = selectedField?.type === 'address';
    const hasField = !!selectedField;
    const needsValue = !VALUELESS_OPERATORS.has(operator);

    const fieldOptions = fields.map(field => ({value: field.key, label: field.name}));
    const operatorOptions = operatorsForCustomFieldType(selectedField?.type).map(op => ({
        value: op,
        label: CUSTOM_FIELD_OPERATOR_LABELS[op] ?? op
    }));

    const handleFieldChange = (nextKey: string) => {
        const nextField = fields.find(field => field.key === nextKey);
        // Default an address to its first sub-field so the value always targets a
        // real JSON path rather than the scalar column it doesn't use.
        const nextSubfield = nextField?.type === 'address' ? ADDRESS_SUBFIELDS[0].value : '';
        onChange([nextKey, nextSubfield, '']);
        // Every field type shares one operator set today, so the current operator
        // stays valid across a field change and needs no reset. When a type with a
        // different set arrives, resetting it here can't piggyback on this call —
        // the framework's updateFilter maps a stale `filters` closure, so a second
        // update in the same tick would clobber this one. It'll need a combined
        // value+operator update path at that point.
    };

    return (
        <>
            <FilterSegmentSelect
                ariaLabel="Custom field"
                options={fieldOptions}
                placeholder="Select field"
                testId="custom-field-filter-field"
                value={fieldKey}
                onChange={handleFieldChange}
            />

            {isAddress && needsValue && (
                <FilterSegmentSelect
                    ariaLabel="Address part"
                    options={ADDRESS_SUBFIELDS}
                    placeholder="Select part"
                    testId="custom-field-filter-subfield"
                    value={subfield}
                    onChange={nextSubfield => onChange([fieldKey, nextSubfield, value])}
                />
            )}

            {hasField && onOperatorChange && (
                <FilterSegmentSelect
                    ariaLabel="Operator"
                    options={operatorOptions}
                    testId="custom-field-filter-operator"
                    value={operator}
                    onChange={onOperatorChange}
                />
            )}

            {hasField && needsValue && (
                <FilterSegmentInput
                    ariaLabel="Value"
                    placeholder="Enter value..."
                    testId="custom-field-filter-value"
                    value={value}
                    onChange={nextValue => onChange([fieldKey, subfield, nextValue])}
                />
            )}
        </>
    );
};

export default CustomFieldFilterRenderer;
