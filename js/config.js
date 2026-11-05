/* ============================================================
 * config.js — 部件元数据与拆解参数
 * 模型本身来自 PX4-gazebo-models 的 x500（BSD-3-Clause），
 * 每个可拆部件的 node 都带 extras.id，这里按 id 补充中文说明、
 * 质量、材质与拆解方向。新增部件只要在这张表里加一行即可。
 * ============================================================ */
window.APP = window.APP || {};

APP.MODEL_URL = 'assets/sf-x500.glb';

/* 拆解方向用「世界坐标」描述，运行时再换算到部件父级坐标系。
 * 留空则由程序根据部件相对机身的方位自动推算（机臂/电机/桨）。 */
APP.PARTS = [
  {
    id: 'body',
    zh: '机身框架',
    en: 'CORE FRAME',
    desc: '碳纤维主框架，承载飞控、电调与电池。四根机臂从这里向外延伸，是整机的受力中心。',
    specs: [['材质', '3K 碳纤维 + 6061 铝'], ['质量', '≈ 210 g'], ['包含', 'FMU·电调·Rails']],
    mass: 210,
    dir: [0, -0.12, 0],
    dist: 0.06,
    delay: 0
  },
  {
    id: 'topCover',
    zh: '上盖',
    en: 'TOP SHELL',
    desc: '覆盖飞控与走线的碳纤维上盖，靠四颗螺丝固定。拆开它才能接触内部电调与传感器。',
    specs: [['材质', '碳纤维板'], ['质量', '≈ 38 g'], ['固定', '4 × M3 螺丝']],
    mass: 38,
    dir: [0, 1, 0],
    dist: 0.62,
    delay: 0.08
  },
  {
    id: 'battery',
    zh: '动力电池',
    en: 'LIPO PACK',
    desc: '4S 锂聚合物电池，通过 XT60 接入电源分配板。全机最重的单体部件，决定续航。',
    specs: [['规格', '4S 5200 mAh'], ['电压', '14.8 V'], ['质量', '≈ 420 g']],
    mass: 420,
    dir: [0, 1, 0.06],
    dist: 0.34,
    delay: 0
  },
  {
    id: 'gimbal',
    zh: '云台相机',
    en: 'GIMBAL / CAM',
    desc: '三轴增稳云台与相机模组，挂在机身腹部。俯仰、横滚、航向各一个无刷电机。',
    specs: [['轴数', '3 轴'], ['质量', '≈ 180 g'], ['安装', '腹部快拆']],
    mass: 180,
    dir: [0, -1, 0.12],
    dist: 0.5,
    delay: 0.05
  },
  {
    id: 'arm_FL',
    zh: '机臂 · 左前',
    en: 'ARM FL',
    desc: '碳纤维方管机臂，根部用两片夹板与机身连接。内部走 ESC 三相线。',
    specs: [['材质', '碳纤维管'], ['质量', '≈ 42 g'], ['长度', '215 mm']],
    mass: 42,
    dir: [1, 0.18, 1],
    dist: 0.55,
    delay: 0.12
  },
  {
    id: 'arm_FR',
    zh: '机臂 · 右前',
    en: 'ARM FR',
    desc: '与左前机臂对称布置，承载右前电机与螺旋桨。',
    specs: [['材质', '碳纤维管'], ['质量', '≈ 42 g'], ['长度', '215 mm']],
    mass: 42,
    dir: [1, 0.18, -1],
    dist: 0.55,
    delay: 0.12
  },
  {
    id: 'arm_RL',
    zh: '机臂 · 左后',
    en: 'ARM RL',
    desc: '后机臂稍短，给云台和起落架让出空间。',
    specs: [['材质', '碳纤维管'], ['质量', '≈ 40 g'], ['长度', '205 mm']],
    mass: 40,
    dir: [-1, 0.18, 1],
    dist: 0.55,
    delay: 0.12
  },
  {
    id: 'arm_RR',
    zh: '机臂 · 右后',
    en: 'ARM RR',
    desc: '与左后机臂对称，四臂构成 X 型布局。',
    specs: [['材质', '碳纤维管'], ['质量', '≈ 40 g'], ['长度', '205 mm']],
    mass: 40,
    dir: [-1, 0.18, -1],
    dist: 0.55,
    delay: 0.12
  },
  {
    id: 'motor_FL',
    zh: '电机 · 左前',
    en: 'MOTOR FL',
    desc: '外转子无刷电机，正转（CCW）。定子固定、外转子的「钟形壳」带动桨叶旋转。',
    specs: [['型号', '2216 KV920'], ['质量', '≈ 56 g'], ['转向', 'CCW']],
    mass: 56,
    dir: [1, 0.55, 1],
    dist: 0.78,
    delay: 0.18
  },
  {
    id: 'motor_FR',
    zh: '电机 · 右前',
    en: 'MOTOR FR',
    desc: '与左前电机反向旋转（CW），抵消反扭矩。四轴靠两正两反维持航向稳定。',
    specs: [['型号', '2216 KV920'], ['质量', '≈ 56 g'], ['转向', 'CW']],
    mass: 56,
    dir: [1, 0.55, -1],
    dist: 0.78,
    delay: 0.18
  },
  {
    id: 'motor_RL',
    zh: '电机 · 左后',
    en: 'MOTOR RL',
    desc: '后左电机，转向与前右相同（CW），对角同向是四轴的基本配置。',
    specs: [['型号', '2216 KV920'], ['质量', '≈ 56 g'], ['转向', 'CW']],
    mass: 56,
    dir: [-1, 0.55, 1],
    dist: 0.78,
    delay: 0.18
  },
  {
    id: 'motor_RR',
    zh: '电机 · 右后',
    en: 'MOTOR RR',
    desc: '后右电机，转向 CCW，与前左同向。',
    specs: [['型号', '2216 KV920'], ['质量', '≈ 56 g'], ['转向', 'CCW']],
    mass: 56,
    dir: [-1, 0.55, -1],
    dist: 0.78,
    delay: 0.18
  },
  {
    id: 'propeller_FL',
    zh: '螺旋桨 · 左前',
    en: 'PROP FL',
    desc: '自紧式两叶桨，靠旋转方向的惯性上紧。桨叶有正反桨之分，装错会大幅损失效率。',
    specs: [['规格', '9450 自紧'], ['质量', '≈ 14 g'], ['旋向', 'CCW']],
    mass: 14,
    dir: [0.5, 1, 0.5],
    dist: 0.60,
    delay: 0.24
  },
  {
    id: 'propeller_FR',
    zh: '螺旋桨 · 右前',
    en: 'PROP FR',
    desc: '反向桨，与左前桨互为镜像。',
    specs: [['规格', '9450 自紧'], ['质量', '≈ 14 g'], ['旋向', 'CW']],
    mass: 14,
    dir: [0.5, 1, -0.5],
    dist: 0.60,
    delay: 0.24
  },
  {
    id: 'propeller_RL',
    zh: '螺旋桨 · 左后',
    en: 'PROP RL',
    desc: '后左桨，与前右桨同向。',
    specs: [['规格', '9450 自紧'], ['质量', '≈ 14 g'], ['旋向', 'CW']],
    mass: 14,
    dir: [-0.5, 1, 0.5],
    dist: 0.60,
    delay: 0.24
  },
  {
    id: 'propeller_RR',
    zh: '螺旋桨 · 右后',
    en: 'PROP RR',
    desc: '后右桨，与前左桨同向。四桨两两反向，抵消偏航力矩。',
    specs: [['规格', '9450 自紧'], ['质量', '≈ 14 g'], ['旋向', 'CCW']],
    mass: 14,
    dir: [-0.5, 1, -0.5],
    dist: 0.60,
    delay: 0.24
  },
  {
    id: 'landingGear',
    zh: '起落架',
    en: 'LANDING GEAR',
    desc: '泡沫脚垫配橡胶缓冲，负责触地吸能，也让云台离地有足够净空。',
    specs: [['材质', 'EVA 泡沫 + 橡胶'], ['质量', '≈ 95 g'], ['数量', '2 组']],
    mass: 95,
    dir: [0, -1, -0.1],
    dist: 0.7,
    delay: 0.1
  }
];

/* 视角预设 */
APP.VIEWS = {
  three: { pos: [1.55, 1.25, 1.85], target: [0, 0.02, 0] },
  top: { pos: [0.02, 2.6, 0.06], target: [0, 0, 0] },
  side: { pos: [2.7, 0.32, 0.0], target: [0, 0.04, 0] },
  front: { pos: [0.0, 0.42, 2.7], target: [0, 0.04, 0] }
};

APP.SETTINGS = {
  cameraStart: 'three',
  autoSpin: true,
  spinSpeed: 0.35,
  fov: 34,
  background: 0x05080e,
  exposure: 0.92,
  explodeStagger: true,
  labelsAt: 0.12
};
