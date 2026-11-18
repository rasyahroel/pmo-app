"use client";

import { useMemo, useState } from "react";
import { App, Avatar, Button, Input, Select, Space, Tag, Typography } from "antd";
import { CloseOutlined, PlusOutlined, TeamOutlined } from "@ant-design/icons";

import { initials } from "@/lib/task-ui";
import { useProjectStructure } from "@/lib/project-structure";
import { mergeParticipants, participantKey, type Participant } from "@/lib/meeting-store";
import { agi } from "@/app/providers";
import { useMasterLists } from "@/lib/master-store";

const { Text } = Typography;

const newId = () => `pt-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// Pengelola peserta rapat. Peserta bisa ditambah kapan saja (juga setelah rapat dibuat) dari tiga sumber:
//  1) Master Pegawai (pegawai internal),  2) anggota tim project,  3) input manual untuk pihak luar.
export default function ParticipantsPicker({
  value = [],
  onChange,
  projectId,
  readOnly,
}: {
  value?: Participant[];
  onChange?: (list: Participant[]) => void;
  projectId?: string;
  readOnly?: boolean;
}) {
  const { employees } = useMasterLists();
  const { message } = App.useApp();
  const structure = useProjectStructure();
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");

  const taken = useMemo(() => new Set(value.map(participantKey)), [value]);
  const options = useMemo(
    () =>
      employees
        .filter((e) => !taken.has(`emp:${e.id}`))
        .map((e) => ({ value: e.id, label: e.name, desc: `${e.directorate} · ${e.subdirectorate}` })),
    [taken, employees],
  );

  function add(list: Participant[]) {
    const merged = mergeParticipants(value, list);
    const added = merged.length - value.length;
    if (added === 0) message.info("Semua sudah ada di daftar peserta.");
    onChange?.(merged);
  }

  function addEmployees(ids: string[]) {
    add(ids.map((id) => employees.find((e) => e.id === id)).filter(Boolean).map((e) => ({ id: newId(), name: e!.name, employeeId: e!.id, external: false })));
  }

  function addProjectTeam() {
    if (!projectId) return;
    add(
      structure.membersOf(projectId).map((m) => ({
        id: newId(),
        name: m.name,
        employeeId: m.employeeId,
        external: !m.employeeId, // vendor / user yang diinput manual = pihak luar dari master
        organization: m.employeeId ? undefined : m.isVendor ? "Vendor" : m.directorate,
      })),
    );
  }

  function addExternal() {
    const n = name.trim();
    if (!n) return;
    add([{ id: newId(), name: n, external: true, organization: org.trim() || undefined }]);
    setName("");
    setOrg("");
  }

  return (
    <div>
      {value.length === 0 ? (
        <Text type="secondary">Belum ada peserta.</Text>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {value.map((p) => (
            <span
              key={p.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "2px 6px 2px 3px",
                borderRadius: 999,
                background: p.external ? "#FFF6E0" : agi[50],
                border: `1px solid ${p.external ? "#F5DDA0" : agi[100]}`,
              }}
            >
              <Avatar size={22} style={{ background: p.external ? "#F6D68A" : agi[200], color: p.external ? "#7A5200" : agi[800], fontSize: 10 }}>
                {initials(p.name)}
              </Avatar>
              <span style={{ fontSize: 13 }}>
                {p.name}
                {p.external && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {" "}
                    · {p.organization ?? "Luar"}
                  </Text>
                )}
              </span>
              {!readOnly && (
                <Button
                  size="small"
                  type="text"
                  icon={<CloseOutlined style={{ fontSize: 10 }} />}
                  aria-label={`Hapus ${p.name}`}
                  onClick={() => onChange?.(value.filter((x) => x.id !== p.id))}
                  style={{ width: 20, height: 20, minWidth: 20 }}
                />
              )}
            </span>
          ))}
        </div>
      )}

      {!readOnly && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <Space.Compact style={{ width: "100%" }}>
            <Select
              mode="multiple"
              showSearch
              style={{ width: "100%" }}
              placeholder="Tambah dari Master Pegawai — ketik nama untuk mencari"
              value={[]}
              onChange={addEmployees}
              filterOption={(input, opt) => `${opt?.label ?? ""} ${(opt as { desc?: string })?.desc ?? ""}`.toLowerCase().includes(input.toLowerCase())}
              options={options}
              optionRender={(o) => (
                <div>
                  <div>{o.label}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{(o.data as { desc?: string }).desc}</Text>
                </div>
              )}
              maxTagCount={0}
              notFoundContent="Tidak ada pegawai lain. Gunakan input manual di bawah."
            />
            {projectId && (
              <Button icon={<TeamOutlined />} onClick={addProjectTeam}>
                Tim project
              </Button>
            )}
          </Space.Compact>

          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Peserta dari luar (tidak ada di master pegawai): isi manual
            </Text>
            <Space.Compact style={{ width: "100%", marginTop: 4 }}>
              <Input
                placeholder="Nama"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                onPressEnter={(e) => {
                  e.preventDefault();
                  addExternal();
                }}
                style={{ flex: 3 }}
              />
              <Input
                placeholder="Instansi / perusahaan (opsional)"
                value={org}
                maxLength={80}
                onChange={(e) => setOrg(e.target.value)}
                onPressEnter={(e) => {
                  e.preventDefault();
                  addExternal();
                }}
                style={{ flex: 3 }}
              />
              <Button icon={<PlusOutlined />} onClick={addExternal} disabled={!name.trim()}>
                Tambah
              </Button>
            </Space.Compact>
          </div>
          <Tag style={{ alignSelf: "flex-start" }}>{value.length} peserta</Tag>
        </div>
      )}
    </div>
  );
}
