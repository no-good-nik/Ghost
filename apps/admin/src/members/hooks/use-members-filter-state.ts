import {type Filter} from '@tryghost/shade/patterns';
import {getMemberFields} from '@/members/member-fields';
import {hasTimezoneSensitiveMemberFilter, isPredicateEnabled, parseMemberFilter, serializeMemberFilters} from '@/members/member-filter-query';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useSearchParams} from 'react-router';
import type {MemberFields} from '@/members/member-fields';

interface SetFiltersOptions {
    replace?: boolean;
}

interface UseMembersFilterStateReturn {
    filters: Filter[];
    nql: string | undefined;
    search: string;
    setFilters: (filters: Filter[], options?: SetFiltersOptions) => void;
    setSearch: (search: string, options?: SetFiltersOptions) => void;
    clearFilters: (options?: SetFiltersOptions) => void;
    clearAll: (options?: SetFiltersOptions) => void;
    hasFilterOrSearch: boolean;
}

interface ToSearchParamsOptions {
    baseSearchParams: URLSearchParams;
    filters: Filter[];
    search: string;
    timezone: string;
    fields: MemberFields;
    customFieldsEnabled: boolean;
}

/**
 * Should the page hold off parsing the URL filter until more data is in?
 *
 * Parsing a date-sensitive filter needs the timezone from settings. If we parse
 * before it resolves, the writeback effect can round-trip the date in UTC
 * instead of site time.
 */
export function shouldDelayMembersDateFilterHydration(
    filterParam: string | undefined,
    hasResolvedDependencies: boolean,
    isLoadingDependencies: boolean = !hasResolvedDependencies
): boolean {
    return Boolean(filterParam) && isLoadingDependencies && !hasResolvedDependencies && hasTimezoneSensitiveMemberFilter(filterParam);
}

// A custom-field predicate only round-trips when the flag is on — otherwise the
// backend has no relation to resolve it against and rejects the whole request. So
// when the flag is off we treat it like any other unrecognised predicate and drop
// it here, before it can reach the URL or the API.
function getEnabledFilters(filters: Filter[], fields: MemberFields, customFieldsEnabled: boolean): Filter[] {
    return filters.filter(predicate => isPredicateEnabled(predicate, fields)
        && (customFieldsEnabled || predicate.field !== 'custom_field'));
}

function toSearchParams({baseSearchParams, filters, search, timezone, fields, customFieldsEnabled}: ToSearchParamsOptions): URLSearchParams {
    const params = new URLSearchParams(baseSearchParams);
    const filter = serializeMemberFilters(getEnabledFilters(filters, fields, customFieldsEnabled), timezone);

    params.delete('filter');
    params.delete('search');

    if (filter) {
        params.set('filter', filter);
    }

    if (search) {
        params.set('search', search);
    }

    return params;
}

export function useMembersFilterState(timezone: string, customFieldsEnabled: boolean = false): UseMembersFilterStateReturn {
    const fields = useMemo(() => getMemberFields(), []);
    const [searchParams, setSearchParams] = useSearchParams();
    const lastWrittenQueryRef = useRef<string | null>(null);
    const filterParam = useMemo(() => searchParams.get('filter') ?? undefined, [searchParams]);
    const currentQuery = useMemo(() => searchParams.toString(), [searchParams]);

    const parsedFilters = useMemo(() => {
        return getEnabledFilters(parseMemberFilter(filterParam, timezone), fields, customFieldsEnabled);
    }, [filterParam, timezone, fields, customFieldsEnabled]);
    const [filters, setDraftFilters] = useState<Filter[]>(parsedFilters);

    const search = useMemo(() => {
        return searchParams.get('search') ?? '';
    }, [searchParams]);

    const nql = useMemo(() => {
        return serializeMemberFilters(getEnabledFilters(filters, fields, customFieldsEnabled), timezone);
    }, [filters, timezone, fields, customFieldsEnabled]);

    useEffect(() => {
        if (currentQuery !== lastWrittenQueryRef.current) {
            setDraftFilters(parsedFilters);
            lastWrittenQueryRef.current = currentQuery;
        }
    }, [currentQuery, parsedFilters]);

    useEffect(() => {
        if (lastWrittenQueryRef.current !== null && currentQuery !== lastWrittenQueryRef.current) {
            return;
        }

        const nextParams = toSearchParams({
            baseSearchParams: searchParams,
            filters,
            search,
            timezone,
            fields,
            customFieldsEnabled
        });
        const nextQuery = nextParams.toString();

        if (nextQuery !== currentQuery) {
            lastWrittenQueryRef.current = nextQuery;
            setSearchParams(nextParams, {replace: true});
        }
    }, [currentQuery, filters, search, searchParams, setSearchParams, timezone, fields, customFieldsEnabled]);

    const setFilters = useCallback((nextFilters: Filter[], setOptions: SetFiltersOptions = {}) => {
        const replace = setOptions.replace ?? true;
        const nextParams = toSearchParams({
            baseSearchParams: searchParams,
            filters: nextFilters,
            search,
            timezone,
            fields,
            customFieldsEnabled
        });

        setDraftFilters(nextFilters);
        lastWrittenQueryRef.current = nextParams.toString();
        setSearchParams(nextParams, {replace});
    }, [search, searchParams, setSearchParams, timezone, fields, customFieldsEnabled]);

    const setSearch = useCallback((nextSearch: string, setOptions: SetFiltersOptions = {}) => {
        const replace = setOptions.replace ?? true;
        const nextParams = toSearchParams({
            baseSearchParams: searchParams,
            filters,
            search: nextSearch,
            timezone,
            fields,
            customFieldsEnabled
        });

        lastWrittenQueryRef.current = nextParams.toString();
        setSearchParams(nextParams, {replace});
    }, [filters, searchParams, setSearchParams, timezone, fields, customFieldsEnabled]);

    const clearFilters = useCallback(({replace = true}: SetFiltersOptions = {}) => {
        const nextParams = toSearchParams({
            baseSearchParams: searchParams,
            filters: [],
            search,
            timezone,
            fields,
            customFieldsEnabled
        });

        setDraftFilters([]);
        lastWrittenQueryRef.current = nextParams.toString();
        setSearchParams(nextParams, {replace});
    }, [search, searchParams, setSearchParams, timezone, fields, customFieldsEnabled]);

    const clearAll = useCallback(({replace = true}: SetFiltersOptions = {}) => {
        const nextParams = toSearchParams({
            baseSearchParams: searchParams,
            filters: [],
            search: '',
            timezone,
            fields,
            customFieldsEnabled
        });

        setDraftFilters([]);
        lastWrittenQueryRef.current = nextParams.toString();
        setSearchParams(nextParams, {replace});
    }, [searchParams, setSearchParams, timezone, fields, customFieldsEnabled]);

    return {
        filters,
        nql,
        search,
        setFilters,
        setSearch,
        clearFilters,
        clearAll,
        hasFilterOrSearch: Boolean(nql) || search.length > 0
    };
}
