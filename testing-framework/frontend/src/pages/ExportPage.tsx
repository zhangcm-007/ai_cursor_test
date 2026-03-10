import { useQuery } from "react-query";
import { Button, Card, Checkbox, Typography, message } from "antd";
import { useState } from "react";
import { requirementsApi } from "../api/requirements";
import { exportApi } from "../api/export";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const [selectedReqIds, setSelectedReqIds] = useState<string[]>([]);
  const { data: requirements = [], isLoading } = useQuery(
    "requirements",
    requirementsApi.list
  );

  const onExportXmind = async () => {
    if (selectedReqIds.length === 0) {
      message.warning("请至少选择一个需求");
      return;
    }
    try {
      const blob = await exportApi.xmind({ requirementIds: selectedReqIds });
      downloadBlob(blob, `xmind_outline_${Date.now()}.txt`);
      message.success("导出成功");
    } catch (e) {
      message.error("导出失败");
    }
  };

  return (
    <div>
      <Typography.Title level={4}>导出 XMind 大纲</Typography.Title>
      <Card>
        <p style={{ marginBottom: 16 }}>
          选择要导出的需求，将生成该需求下所有测试用例的 XMind 大纲文件（.txt），可在 XMind 中通过「文件 → 导入 → 大纲」使用。
        </p>
        {isLoading ? (
          <div>加载中...</div>
        ) : (
          <>
            <Checkbox.Group
              value={selectedReqIds}
              onChange={(v) => setSelectedReqIds(v as string[])}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              {requirements.map((r) => (
                <Checkbox key={r.id} value={r.id}>
                  {r.title}
                </Checkbox>
              ))}
            </Checkbox.Group>
            {requirements.length === 0 && (
              <div style={{ color: "#999" }}>暂无需求</div>
            )}
            <div style={{ marginTop: 16 }}>
              <Button
                type="primary"
                onClick={onExportXmind}
                disabled={selectedReqIds.length === 0}
              >
                导出 XMind 大纲
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
