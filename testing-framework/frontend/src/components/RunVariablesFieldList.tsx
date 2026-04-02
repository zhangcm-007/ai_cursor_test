import { Button, Card, Form, Input, Space, Tag } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { emptyRunVarRow, type RunVarFormRow } from "../utils/runVariablesForm";

function RunVarRowSourceTag({ listName, index }: { listName: string; index: number }) {
  const form = Form.useFormInstance();
  const source = Form.useWatch([listName, index, "source"], form);
  const varValue = Form.useWatch([listName, index, "varValue"], form);
  const sv = String(varValue ?? "");
  const hasPlaceholder = /\{\{[^}]+\}\}/.test(sv);
  if (source === "imported_env") {
    return (
      <Tag color="processing" style={{ fontSize: 11, margin: 0, lineHeight: "18px" }}>
        从环境导入
      </Tag>
    );
  }
  if (hasPlaceholder) {
    return (
      <Tag color="gold" style={{ fontSize: 11, margin: 0, lineHeight: "18px" }}>
        内置 / 引用
      </Tag>
    );
  }
  return (
    <Tag style={{ fontSize: 11, margin: 0, lineHeight: "18px" }}>手动填写</Tag>
  );
}

type Props = {
  /** Form.List 字段名，默认 runVarList */
  listName?: string;
  /** 是否展示来源标签（手动 / 内置引用 / 从环境导入），与「自动提取到环境」区分 */
  showSourceTags?: boolean;
  /** 单行「合并到环境」：参数为 Form.List 行下标 */
  onMergeRowToEnvironment?: (fieldIndex: number) => void;
  /** 正在合并的行下标（用于 loading），与 onMergeRowToEnvironment 成对使用 */
  mergeRowLoadingIndex?: number | null;
};

/**
 * 运行变量：键值表格（与调试断言同为 Form.List + Card 行）。
 */
export function RunVariablesFieldList({
  listName = "runVarList",
  showSourceTags = false,
  onMergeRowToEnvironment,
  mergeRowLoadingIndex = null,
}: Props) {
  return (
    <Form.List name={listName}>
      {(fields, { add, remove }) => (
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          {fields.map(({ key, name, ...restField }) => (
            <Card
              key={key}
              size="small"
              bodyStyle={{ padding: "10px 12px" }}
              style={{ background: "rgba(0,0,0,0.15)", borderColor: "rgba(148,163,184,0.25)" }}
            >
              <Space wrap align="end" style={{ width: "100%" }}>
                <Form.Item name={[name, "source"]} hidden>
                  <Input type="hidden" />
                </Form.Item>
                {showSourceTags ? (
                  <div style={{ flexShrink: 0, minWidth: 100 }}>
                    <div style={{ fontSize: 11, color: "#8c8c8c", marginBottom: 4, lineHeight: 1 }}>来源</div>
                    <RunVarRowSourceTag listName={listName} index={name} />
                  </div>
                ) : null}
                <Form.Item
                  {...restField}
                  name={[name, "varName"]}
                  label="变量名"
                  rules={[
                    {
                      validator: async (_, v) => {
                        const s = String(v ?? "").trim();
                        if (!s) return Promise.resolve();
                        if (!/^\w+$/.test(s)) {
                          return Promise.reject(new Error("仅字母数字下划线"));
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                  style={{ marginBottom: 0, minWidth: 140 }}
                >
                  <Input placeholder="email" autoComplete="off" />
                </Form.Item>
                <Form.Item
                  name={[name, "varValue"]}
                  label="值"
                  style={{ marginBottom: 0, flex: 1, minWidth: 200 }}
                >
                  <Input placeholder="159@qq.com 或内置占位见说明" autoComplete="off" />
                </Form.Item>
                <Form.Item label=" " colon={false} style={{ marginBottom: 0, flexShrink: 0 }}>
                  <Space size={0} wrap align="center">
                    {onMergeRowToEnvironment ? (
                      <Button
                        type="link"
                        size="small"
                        loading={mergeRowLoadingIndex === name}
                        onClick={() => onMergeRowToEnvironment(name)}
                      >
                        合并此项到环境
                      </Button>
                    ) : null}
                    <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => remove(name)}>
                      删除
                    </Button>
                  </Space>
                </Form.Item>
              </Space>
            </Card>
          ))}
          <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add(emptyRunVarRow() as RunVarFormRow)}>
            添加变量
          </Button>
        </Space>
      )}
    </Form.List>
  );
}
