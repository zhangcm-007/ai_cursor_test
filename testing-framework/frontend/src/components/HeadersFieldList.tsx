import { Button, Form, Input, Space } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";

export type HeaderRow = { key: string; value: string };

export const emptyHeaderRow = (): HeaderRow => ({ key: "", value: "" });

export function headersObjectToList(obj: Record<string, string> | string | undefined): HeaderRow[] {
  if (!obj) return [];
  let parsed = obj;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as Record<string, string>;
    } catch {
      return [];
    }
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) return [];
  return Object.entries(parsed).map(([k, v]) => ({ key: k, value: String(v ?? "") }));
}

export function headersListToObject(list: HeaderRow[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!list) return out;
  for (const r of list) {
    const k = (r.key ?? "").trim();
    if (k) out[k] = r.value ?? "";
  }
  return out;
}

export function headersListToJsonString(list: HeaderRow[] | undefined): string {
  const obj = headersListToObject(list);
  return Object.keys(obj).length ? JSON.stringify(obj, null, 2) : "{}";
}

type Props = {
  listName?: string;
};

export function HeadersFieldList({ listName = "headerList" }: Props) {
  return (
    <Form.List name={listName}>
      {(fields, { add, remove }) => (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(140px,1fr) minmax(200px,2fr) 40px",
              gap: "0 8px",
              marginBottom: fields.length ? 4 : 0,
            }}
          >
            {fields.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: "#8c8c8c", padding: "0 0 2px 2px" }}>Header 名</div>
                <div style={{ fontSize: 11, color: "#8c8c8c", padding: "0 0 2px 2px" }}>值</div>
                <div />
              </>
            )}
            {fields.map(({ key, name, ...restField }) => (
              <>
                <Form.Item
                  key={`${key}-k`}
                  {...restField}
                  name={[name, "key"]}
                  style={{ marginBottom: 4 }}
                >
                  <Input
                    size="small"
                    placeholder="Content-Type"
                    autoComplete="off"
                    style={{ fontFamily: "monospace", fontSize: 12 }}
                  />
                </Form.Item>
                <Form.Item
                  key={`${key}-v`}
                  {...restField}
                  name={[name, "value"]}
                  style={{ marginBottom: 4 }}
                >
                  <Input
                    size="small"
                    placeholder="application/json"
                    autoComplete="off"
                    style={{ fontFamily: "monospace", fontSize: 12 }}
                  />
                </Form.Item>
                <Button
                  key={`${key}-d`}
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => remove(name)}
                  style={{ marginBottom: 4 }}
                />
              </>
            ))}
          </div>
          <Space size={8}>
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => add(emptyHeaderRow())}>
              添加请求头
            </Button>
          </Space>
        </div>
      )}
    </Form.List>
  );
}
