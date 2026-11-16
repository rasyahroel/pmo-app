"use client";

import { useState } from "react";
import { Button, Modal, Form, Input, Select, Space, Popconfirm, message, Typography } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { getSubditOptions, type Employee } from "@/lib/mock-data";
import DataTable from "@/components/common/DataTable";

const { Text } = Typography;

type FormValues = {
    name: string;
    directorate: string;
    subdirectorate: string;
    roles: string[];
};

// Ini master PEGAWAI — daftar orang yang bisa dipilih jadi PMO/Developer/User
// pas nambah anggota tim project. Bukan akun login aplikasi ini (itu ada di
// menu User Management terpisah); pegawai di sini belum tentu pernah buka
// aplikasi ini sama sekali.
export default function EmployeesCrud({
    initialItems,
    directorateOptions,
    roleOptions,
}: {
    initialItems: Employee[];
    directorateOptions: string[];
    roleOptions: string[];
}) {
    const [items, setItems] = useState(initialItems);
    const [open, setOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [form] = Form.useForm<FormValues>();

    const directorate = Form.useWatch("directorate", form);

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
        message.success("Pegawai dihapus.");
    }

    function handleSubmit() {
        form.validateFields().then((values) => {
            if (editingIndex === null) {
                setItems((prev) => [...prev, { id: `emp-${Date.now()}`, ...values }]);
                message.success("Pegawai ditambahkan.");
            } else {
                setItems((prev) => prev.map((v, i) => (i === editingIndex ? { ...v, ...values } : v)));
                message.success("Pegawai diperbarui.");
            }
            setOpen(false);
        });
    }

    return (
        <div>
            <Text type="secondary" style={{ display: "block", marginBottom: 12, fontSize: 13 }}>
                Daftar pegawai yang bisa dipilih jadi PMO/Developer/User saat menambah anggota tim di sebuah project.
                Terpisah dari akun login aplikasi ini (lihat menu User Management).
            </Text>
            <DataTable
                rowKey="id"
                dataSource={items.map((item, index) => ({ ...item, index }))}
                searchPlaceholder="Cari nama, direktorat, subdit, role..."
                toolbar={
                    <Button icon={<PlusOutlined />} type="primary" onClick={openCreate}>
                        Tambah Pegawai
                    </Button>
                }
                columns={[
                    { title: "Nama", dataIndex: "name" },
                    { title: "Direktorat", dataIndex: "directorate", filterable: true },
                    { title: "Subdit", dataIndex: "subdirectorate", filterable: true },
                    { title: "Bisa Jadi Role", dataIndex: "roles", filterable: true, render: (v: string[]) => v.join(", ") },
                    {
                        title: "Aksi",
                        width: 120,
                        render: (_, r) => (
                            <Space>
                                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r.index)} />
                                <Popconfirm title="Hapus pegawai ini?" onConfirm={() => handleDelete(r.index)} okText="Hapus" cancelText="Batal">
                                    <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                            </Space>
                        ),
                    },
                ]}
            />

            <Modal
                title={editingIndex === null ? "Tambah Pegawai" : "Ubah Pegawai"}
                open={open}
                onCancel={() => setOpen(false)}
                onOk={handleSubmit}
                okText="Simpan"
                cancelText="Batal"
                destroyOnHidden
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="name" label="Nama" rules={[{ required: true, message: "Wajib diisi" }]}>
                        <Input placeholder="Nama lengkap" />
                    </Form.Item>
                    <Form.Item name="directorate" label="Direktorat" rules={[{ required: true, message: "Wajib diisi" }]}>
                        <Select
                            options={directorateOptions.map((d) => ({ label: d, value: d }))}
                            onChange={() => form.setFieldsValue({ subdirectorate: undefined })}
                        />
                    </Form.Item>
                    <Form.Item name="subdirectorate" label="Subdit" rules={[{ required: true, message: "Wajib diisi" }]}>
                        <Select
                            placeholder={directorate ? "Pilih subdit" : "Pilih direktorat dulu"}
                            disabled={!directorate}
                            options={getSubditOptions(directorate).map((s) => ({ label: s.subdirectorate, value: s.subdirectorate }))}
                        />
                    </Form.Item>
                    <Form.Item name="roles" label="Bisa Dipilih Jadi Role" rules={[{ required: true, message: "Wajib diisi" }]}>
                        <Select mode="multiple" options={roleOptions.map((r) => ({ label: r, value: r }))} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
