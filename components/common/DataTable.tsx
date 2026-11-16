"use client";

import { useMemo, useState, type Key, type ReactNode } from "react";
import { Table, Input, Space } from "antd";
import type { TableColumnType, TableProps } from "antd";
import { SearchOutlined } from "@ant-design/icons";

// Kolom tabel + opsi tambahan:
// - sortable   : default true kalau kolom punya dataIndex (string) & belum punya sorter
// - filterable : bikin dropdown filter otomatis dari nilai unik di kolom itu
// - searchable : ikut dicari lewat kotak search (default true kalau ada dataIndex)
// - searchValue: teks pencarian custom (dipakai kalau kolom tanpa dataIndex / render-nya kompleks)
export type DataColumn<T> = TableColumnType<T> & {
    sortable?: boolean;
    filterable?: boolean;
    searchable?: boolean;
    searchValue?: (record: T) => string;
};

type Props<T> = Omit<TableProps<T>, "columns" | "dataSource" | "title"> & {
    columns: DataColumn<T>[];
    dataSource: T[];
    toolbar?: ReactNode; // mis. tombol "Tambah ..." (tampil di kiri kotak search)
    searchPlaceholder?: string;
    defaultPageSize?: number;
};

function getValue<T>(record: T, dataIndex: unknown): unknown {
    if (Array.isArray(dataIndex)) {
        return dataIndex.reduce<unknown>((acc, k) => (acc == null ? acc : (acc as Record<string, unknown>)[String(k)]), record);
    }
    if (dataIndex == null) return undefined;
    return (record as Record<string, unknown>)[String(dataIndex)];
}

function toText(v: unknown): string {
    if (v == null) return "";
    if (Array.isArray(v)) return v.map(toText).join(", ");
    if (typeof v === "object") return "";
    return String(v);
}

export default function DataTable<T extends object>({
    columns,
    dataSource,
    toolbar,
    searchPlaceholder = "Cari...",
    defaultPageSize = 10,
    pagination,
    ...rest
}: Props<T>) {
    const [search, setSearch] = useState("");

    const filteredData = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return dataSource;
        return dataSource.filter((record) =>
            columns.some((col) => {
                if (col.searchable === false) return false;
                const text = col.searchValue
                    ? col.searchValue(record)
                    : col.dataIndex != null
                        ? toText(getValue(record, col.dataIndex))
                        : "";
                return text.toLowerCase().includes(q);
            })
        );
    }, [dataSource, columns, search]);

    const enhancedColumns = useMemo<TableColumnType<T>[]>(
        () =>
            columns.map((col) => {
                const { sortable, filterable, searchable, searchValue, ...antdCol } = col;
                void searchable;
                void searchValue;
                const hasIndex = col.dataIndex != null;
                const next: TableColumnType<T> = { ...antdCol };

                if (hasIndex && !col.sorter && sortable !== false) {
                    next.sorter = (a, b) => {
                        const va = getValue(a, col.dataIndex);
                        const vb = getValue(b, col.dataIndex);
                        if (typeof va === "number" && typeof vb === "number") return va - vb;
                        return toText(va).localeCompare(toText(vb), "id", { numeric: true, sensitivity: "base" });
                    };
                }

                if (hasIndex && filterable && !col.filters) {
                    const values = new Set<string>();
                    dataSource.forEach((r) => {
                        const v = getValue(r, col.dataIndex);
                        if (Array.isArray(v)) v.forEach((x) => values.add(toText(x)));
                        else if (typeof v === "boolean") values.add(String(v));
                        else if (toText(v)) values.add(toText(v));
                    });
                    next.filters = Array.from(values)
                        .sort((a, b) => a.localeCompare(b, "id"))
                        .map((v) => ({ text: v, value: v }));
                    next.onFilter = (value: boolean | Key, record: T) => {
                        const v = getValue(record, col.dataIndex);
                        if (Array.isArray(v)) return v.map(toText).includes(String(value));
                        return toText(v) === String(value);
                    };
                    next.filterSearch = true;
                }
                return next;
            }),
        [columns, dataSource]
    );

    return (
        <div>
            <Space style={{ marginBottom: 12, width: "100%", justifyContent: "space-between" }} wrap>
                <div>{toolbar}</div>
                <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: 300, maxWidth: "100%" }}
                />
            </Space>
            <Table<T>
                {...rest}
                columns={enhancedColumns}
                dataSource={filteredData}
                pagination={
                    pagination === false
                        ? false
                        : {
                            pageSize: defaultPageSize,
                            showSizeChanger: true,
                            pageSizeOptions: [10, 20, 50, 100],
                            showTotal: (total, range) => `${range[0]}-${range[1]} dari ${total}`,
                            ...(pagination || {}),
                        }
                }
            />
        </div>
    );
}
