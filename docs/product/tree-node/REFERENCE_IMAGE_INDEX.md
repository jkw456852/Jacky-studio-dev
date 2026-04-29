# 树状节点参考图索引

目录用途：
- 固定存放树状节点视觉参考图原件
- 供 [TREE_NODE_IMPLEMENTATION_PLAN_20260424.md](./TREE_NODE_IMPLEMENTATION_PLAN_20260424.md) 引用
- 后续实现、回归、验收统一以此目录中的图片为准

## 目标文件名

请将三张参考图固定为以下文件名：

1. `tree-node-ref-01-image-node-selected.png`
- 含义：树状图片节点选中态
- 对应：图一

2. `tree-node-ref-02-prompt-node-selected.png`
- 含义：树状关键词节点选中态
- 对应：图二

3. `tree-node-ref-03-node-idle-states.png`
- 含义：树状关键词节点与树状图片节点非选中态
- 对应：图三

## 当前状态

三张参考图已落盘到本目录，当前正式文件如下：

1. `tree-node-ref-01-image-node-selected.png`
- 树状图片节点选中态
- 文件大小：104226 bytes

2. `tree-node-ref-02-prompt-node-selected.png`
- 树状关键词节点选中态
- 文件大小：24492 bytes

3. `tree-node-ref-03-node-idle-states.png`
- 树状关键词节点与树状图片节点非选中态
- 文件大小：121816 bytes

## 落盘后更新要求

参考图已落盘，后续若替换图片版本，需同步更新：

1. [TREE_NODE_IMPLEMENTATION_PLAN_20260424.md](./TREE_NODE_IMPLEMENTATION_PLAN_20260424.md)
2. 本索引文件

## 使用约束

后续树状节点开发中：

1. 图一作为树状图片节点选中态基准
2. 图二作为树状关键词节点选中态基准
3. 图三作为两类节点非选中态基准
4. 若实现与这三张图冲突，以这三张图为准，不得凭印象改形
