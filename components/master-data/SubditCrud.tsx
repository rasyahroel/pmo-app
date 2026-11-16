"use client";

import { useState } from "react";
import { Button, Modal, Form, Input, Select, Space, Popconfirm, message, Typography, Tag } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import DataTable from "@/components/common/DataTable";

const { Text } = Typography;

type SubditItem = { directorate: string; subdirectorate: string };
type FormValues = { directorate: string; subdirectorate: string };

// Subdit selalu berelasi ke satu Direktorat induk. Pilih Direktorat dulu di
// form, baru isi nama Subdit-nya — ini yang bikin dropdown "Subdit" di form
// project/pegawai lain otomatis ke-filter sesuai Direktorat yang dipilih.
export default function SubditCrud({
    initialItems,
    directorateOptions,
}: {
    initialItems: SubditItem[];
    directorateOptions: string[];
}) {
    const [items, setItems] = useState(initialItems);
    const [open, setOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [form] = Form.useForm<FormValues>();

    function openCreate() {
        setEditingIndex(null);
        form.resetFields();
        setOpen(true);
    }

    function openEdit(index: number) {
        setEditingIndex(index);
        form.setFieldsValue(items[index]);
        setOpen(true);
    }

    function handleDelete(index: number) {
        setItems((prev) => prev.filter((_, i) => i !== index));
        message.success("Subdit dihapus.");
    }

    function handleSubmit() {
        form.validateFields().then((values) => {
            if (editingIndex === null) {
                setItems((prev) => [...prev, values]);
                message.success("Subdit ditambahkan.");
            } else {
                setItems((prev) => prev.map((v, i) => (i === editingIndex ? values : v)));
                message.success("Subdit diperbarui.");
            }
            setOpen(false);
        });
    }

    const sorted = [...items].sort((a, b) => a.directorate.localeCompare(b.directorate));

    return (
        <div>
            <DataTable
                rowKey={(r) => `${r.directorate}-${r.subdirectorate}`}
                dataSource={sorted.map((item) => ({ ...item, index: items.indexOf(item) }))}
                searchPlaceholder="Cari direktorat/subdit..."
                toolbar={
                    <Button icon={<PlusOutlined />} type="primary" onClick={openCreate}>
                        Tambah Subdit
                    </Button>
                }
                columns={[
                    {
                        title: "Direktorat",
                        dataIndex: "directorate",
                        filterable: true,
                        render: (v: string) => <Tag color="blue">{v}</Tag>,
                    },
                    { title: "Subdit", dataIndex: "subdirectorate" },
                    {
                        title: "Aksi",
                        width: 120,
                        render: (_, r) => (
                            <Space>
                                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r.index)} />
                                <Popconfirm title="Hapus subdit ini?" onConfirm={() => handleDelete(r.index)} okText="Hapus" cancelText="Batal">
                                    <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                            </Space>
                        ),
                    },
                ]}
            />

            <Modal
                title={editingIndex === null ? "Tambah Subdit" : "Ubah Subdit"}
                open={open}
                onCancel={() => setOpen(false)}
                onOk={handleSubmit}
                okText="Simpan"
                cancelText="Batal"
                destroyOnHidden
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="directorate" label="Direktorat" rules={[{ required: true, message: "Wajib diisi" }]}>
                        <Select
                            placeholder="Pilih direktorat induk dulu"
                            options={directorateOptions.map((d) => ({ label: d, value: d }))}
                        />
                    </Form.Item>
                    <Form.Item name="subdirectorate" label="Nama Subdit" rules={[{ required: true, message: "Wajib diisi" }]}>
                        <Input placeholder="mis. Subdit Development" />
                    </Form.Item>
                </Form>
                {directorateOptions.length === 0 && (
                    <Text type="secondary" style={{ fontSize: 12 }}>Belum ada Direktorat di master — tambahkan dulu di tab Direktorat.</Text>
                )}
            </Modal>
        </div>
    );
}
