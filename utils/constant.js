/**
 * 常量定义
 */

// ========== 用户相关 ==========
const USER_STATUS = {
  ACTIVE: 'active',
  DISABLED: 'disabled'
};

const USER_ROLES = {
  STUDENT: 'student',
  TEACHER: 'teacher'
};

const GRADE_OPTIONS = [
  {label: '一年级', value: '一年级'},
  {label: '二年级', value: '二年级'},
  {label: '三年级', value: '三年级'},
  {label: '四年级', value: '四年级'},
  {label: '五年级', value: '五年级'},
  {label: '六年级', value: '六年级'},
  {label: '初一', value: '初一'},
  {label: '初二', value: '初二'},
  {label: '初三', value: '初三'},
  {label: '高一', value: '高一'},
  {label: '高二', value: '高二'},
  {label: '高三', value: '高三'},
];

// ========== 任务相关 ==========
const TASK_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const TASK_DIFFICULTY = {
  EASY: 1,
  NORMAL: 2,
  HARD: 3,
  EXPERT: 4,
  MASTER: 5
};

const TASK_DIFFICULTY_TEXT = {
  [TASK_DIFFICULTY.EASY]: '入门',
  [TASK_DIFFICULTY.NORMAL]: '基础',
  [TASK_DIFFICULTY.HARD]: '进阶',
  [TASK_DIFFICULTY.EXPERT]: '高级',
  [TASK_DIFFICULTY.MASTER]: '专家'
};

const TASK_DIFFICULTY_COLOR = {
  [TASK_DIFFICULTY.EASY]: '#52c41a',
  [TASK_DIFFICULTY.NORMAL]: '#1890ff',
  [TASK_DIFFICULTY.HARD]: '#faad14',
  [TASK_DIFFICULTY.EXPERT]: '#ff4d4f',
  [TASK_DIFFICULTY.MASTER]: '#722ed1'
};

// ========== 提交相关 ==========
const SUBMISSION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

const SUBMISSION_STATUS_TEXT = {
  [SUBMISSION_STATUS.PENDING]: '待审核',
  [SUBMISSION_STATUS.APPROVED]: '已通过',
  [SUBMISSION_STATUS.REJECTED]: '已拒绝'
};

const SUBMISSION_STATUS_COLOR = {
  [SUBMISSION_STATUS.PENDING]: '#faad14',
  [SUBMISSION_STATUS.APPROVED]: '#52c41a',
  [SUBMISSION_STATUS.REJECTED]: '#ff4d4f'
};

// ========== 班级相关 ==========
const CLASS_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived'
};

const CLASS_MEMBER_ROLE = {
  MEMBER: 'member',
  ADMIN: 'admin'
};

const APPLICATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

// ========== 抽奖相关 ==========
const PRIZE_TYPE = {
  PHYSICAL: 'physical',
  VIRTUAL: 'virtual',
  POINTS: 'points'
};

const DRAW_RECORD_STATUS = {
  DRAWN: 'drawn',
  CLAIMED: 'claimed',
  EXPIRED: 'expired'
};

// ========== 项目相关 ==========
const PROJECT_STATUS = {
  ACTIVE: 'active',
  DISABLED: 'disabled'
};

const PROJECT_CODES = {
  PROGRAMMING: 'programming',
  DRONE: 'drone',
  ROBOT: 'robot'
};

const PROJECT_NAMES = {
  [PROJECT_CODES.PROGRAMMING]: '编程',
  [PROJECT_CODES.DRONE]: '无人机',
  [PROJECT_CODES.ROBOT]: '机器人'
};

// ========== 系统配置相关 ==========
const CONFIG_CATEGORY = {
  POINTS: 'points',
  LOTTERY: 'lottery',
  TASK: 'task',
  CLASS: 'class',
  USER: 'user',
  SYSTEM: 'system'
};

const CONFIG_VALUE_TYPE = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  JSON: 'json'
};

// ========== 缓存相关 ==========
const CACHE_KEYS = {
  USER_INFO: 'userInfo',
  OPENID: 'openid',
  TOKEN: 'token',
  CONFIG: 'systemConfig',
  PROJECTS: 'projects'
};

const CACHE_DURATION = {
  SHORT: 1 * 60 * 1000,        // 1分钟
  MEDIUM: 5 * 60 * 1000,       // 5分钟
  LONG: 10 * 60 * 1000,        // 10分钟
  VERY_LONG: 30 * 60 * 1000    // 30分钟
};

// ========== 分页相关 ==========
const PAGE_SIZE = {
  SMALL: 10,
  MEDIUM: 20,
  LARGE: 50
};

const DEFAULT_PAGE_SIZE = PAGE_SIZE.MEDIUM;

// ========== 图片相关 ==========
const IMAGE_MAX_SIZE = 10 * 1024 * 1024; // 10MB

const IMAGE_MAX_COUNT = {
  TASK: 9,
  SUBMISSION: 9,
  AVATAR: 1
};

// ========== 文件相关 ==========
const FILE_MAX_SIZE = 50 * 1024 * 1024; // 50MB

const FILE_MAX_COUNT = 5;

const FILE_ALLOWED_TYPES = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'mp4', 'mp3', 'zip', 'rar'
];

// ========== 错误码 ==========
const ERROR_CODE = {
  SUCCESS: 0,
  UNKNOWN_ERROR: -1,
  PARAMS_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
  
  // 用户相关 1000-1999
  USER_NOT_REGISTERED: 1001,
  USER_ALREADY_EXISTS: 1002,
  USER_DISABLED: 1003,
  
  // 班级相关 2000-2999
  CLASS_NOT_FOUND: 2001,
  CLASS_FULL: 2002,
  ALREADY_IN_CLASS: 2003,
  NOT_CLASS_MEMBER: 2004,
  
  // 任务相关 3000-3999
  TASK_NOT_FOUND: 3001,
  TASK_EXPIRED: 3002,
  SUBMISSION_LIMIT_EXCEEDED: 3003,
  ALREADY_SUBMITTED: 3004,
  
  // 积分相关 4000-4999
  POINTS_NOT_ENOUGH: 4001,
  POINTS_LIMIT_EXCEEDED: 4002,
  
  // 抽奖相关 5000-5999
  LOTTERY_DISABLED: 5001,
  LOTTERY_LIMIT_EXCEEDED: 5002,
  PRIZE_OUT_OF_STOCK: 5003
};

// ========== 年级选项 ==========
const SCHOOL_TYPE = {
  PRIMARY: 'primary',
  MIDDLE: 'middle',
  HIGH: 'high'
};

const SCHOOL_GRADES = {
  [SCHOOL_TYPE.PRIMARY]: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
  [SCHOOL_TYPE.MIDDLE]: ['七年级', '八年级', '九年级'],
  [SCHOOL_TYPE.HIGH]: ['高一', '高二', '高三']
};

module.exports = {
  USER_STATUS,
  USER_ROLES,
  GRADE_OPTIONS,
  TASK_STATUS,
  TASK_DIFFICULTY,
  TASK_DIFFICULTY_TEXT,
  TASK_DIFFICULTY_COLOR,
  SUBMISSION_STATUS,
  SUBMISSION_STATUS_TEXT,
  SUBMISSION_STATUS_COLOR,
  CLASS_STATUS,
  CLASS_MEMBER_ROLE,
  APPLICATION_STATUS,
  PRIZE_TYPE,
  DRAW_RECORD_STATUS,
  PROJECT_STATUS,
  PROJECT_CODES,
  PROJECT_NAMES,
  CONFIG_CATEGORY,
  CONFIG_VALUE_TYPE,
  CACHE_KEYS,
  CACHE_DURATION,
  PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  IMAGE_MAX_SIZE,
  IMAGE_MAX_COUNT,
  FILE_MAX_SIZE,
  FILE_MAX_COUNT,
  FILE_ALLOWED_TYPES,
  ERROR_CODE,
  SCHOOL_TYPE,
  SCHOOL_GRADES
};
