/**
 * 项目配置服务
 */

const { configApi } = require('../services/api');
const { setProjects, getProjects, setConfig, getConfig } = require('../services/storage');
const { PROJECT_CODES, PROJECT_NAMES } = require('../utils/constant');

class ProjectService {
  constructor() {
    this.projects = [];
    this.config = null;
    this.projectsLoaded = false;
    this.configLoaded = false;
  }

  static getInstance() {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService();
    }
    return ProjectService.instance;
  }

  /**
   * 获取项目列表
   */
  async getProjects(forceRefresh = false) {
    if (!forceRefresh && this.projectsLoaded && this.projects.length > 0) {
      return this.projects;
    }

    // 先尝试从缓存获取
    if (!forceRefresh) {
      const cached = getProjects();
      if (cached && cached.length > 0) {
        this.projects = cached;
        this.projectsLoaded = true;
        return this.projects;
      }
    }

    // 从服务器获取
    try {
      const res = await configApi.getProjects({ status: 'active' });
      if (res.success && res.data) {
        this.projects = res.data;
        this.projectsLoaded = true;
        setProjects(this.projects);
        return this.projects;
      }
    } catch (error) {
      console.error('[ProjectService] getProjects error:', error);
    }

    // 返回默认项目
    return this.getDefaultProjects();
  }

  /**
   * 根据 ID 获取项目
   */
  async getProjectById(projectId) {
    const projects = await this.getProjects();
    return projects.find(p => p._id === projectId) || null;
  }

  /**
   * 根据 code 获取项目
   */
  async getProjectByCode(projectCode) {
    const projects = await this.getProjects();
    return projects.find(p => p.project_code === projectCode) || null;
  }

  /**
   * 获取项目选项（用于下拉选择）
   */
  async getProjectOptions() {
    const projects = await this.getProjects();
    return projects.map(p => ({
      label: p.project_name,
      value: p._id
    }));
  }

  /**
   * 获取项目难度选项
   */
  async getDifficultyOptions(projectId) {
    const project = await this.getProjectById(projectId);
    if (!project) return [];

    return project.difficulty_levels.map(d => ({
      label: d.name,
      value: d.level,
      color: d.color
    }));
  }

  /**
   * 获取项目分类选项
   */
  async getCategoryOptions(projectId) {
    const project = await this.getProjectById(projectId);
    return project?.task_categories || [];
  }

  /**
   * 获取系统配置
   */
  async getConfig(forceRefresh = false) {
    if (!forceRefresh && this.configLoaded && this.config) {
      return this.config;
    }

    // 先尝试从缓存获取
    if (!forceRefresh) {
      const cached = getConfig();
      if (cached) {
        this.config = cached;
        this.configLoaded = true;
        return this.config;
      }
    }

    // 从服务器获取
    try {
      const res = await configApi.getConfig();
      if (res.success && res.data) {
        this.config = this.parseConfig(res.data);
        this.configLoaded = true;
        setConfig(this.config);
        return this.config;
      }
    } catch (error) {
      console.error('[ProjectService] getConfig error:', error);
    }

    // 返回默认配置
    const defaultConfig = this.getDefaultConfig();
    this.config = defaultConfig;
    return defaultConfig;
  }

  /**
   * 解析配置数据
   */
  parseConfig(configArray) {
    const config = {};
    configArray.forEach((item) => {
      config[item.key] = item.value;
    });
    return { ...this.getDefaultConfig(), ...config };
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig() {
    return {
      points_register_gift: 50,
      points_per_task: 10,
      points_daily_limit: 100,
      lottery_enabled: true,
      lottery_cost_points: 10,
      lottery_daily_limit: 5,
      class_max_members: 50,
      class_join_need_approval: true,
      task_max_submissions: 3,
      task_overtime_penalty: 0.5
    };
  }

  /**
   * 获取默认项目
   */
  getDefaultProjects() {
    return [
      {
        _id: 'default_programming',
        project_name: PROJECT_NAMES[PROJECT_CODES.PROGRAMMING],
        project_code: PROJECT_CODES.PROGRAMMING,
        description: '编程基础与进阶训练',
        cover_image: '',
        icon: '',
        difficulty_levels: [
          { level: 1, name: '入门', color: '#52c41a' },
          { level: 2, name: '基础', color: '#1890ff' },
          { level: 3, name: '进阶', color: '#faad14' },
          { level: 4, name: '高级', color: '#ff4d4f' },
          { level: 5, name: '专家', color: '#722ed1' }
        ],
        task_categories: ['基础语法', '算法练习', '项目实战', '竞赛模拟'],
        default_points: 10,
        sort_order: 1,
        status: 'active',
        task_count: 0,
        student_count: 0
      },
      {
        _id: 'default_drone',
        project_name: PROJECT_NAMES[PROJECT_CODES.DRONE],
        project_code: PROJECT_CODES.DRONE,
        description: '无人机操控与编程训练',
        cover_image: '',
        icon: '',
        difficulty_levels: [
          { level: 1, name: '入门', color: '#52c41a' },
          { level: 2, name: '基础', color: '#1890ff' },
          { level: 3, name: '进阶', color: '#faad14' },
          { level: 4, name: '高级', color: '#ff4d4f' },
          { level: 5, name: '专家', color: '#722ed1' }
        ],
        task_categories: ['基础飞行', '航拍技巧', '编程控制', '竞赛模拟'],
        default_points: 10,
        sort_order: 2,
        status: 'active',
        task_count: 0,
        student_count: 0
      },
      {
        _id: 'default_robot',
        project_name: PROJECT_NAMES[PROJECT_CODES.ROBOT],
        project_code: PROJECT_CODES.ROBOT,
        description: '机器人组装与编程训练',
        cover_image: '',
        icon: '',
        difficulty_levels: [
          { level: 1, name: '入门', color: '#52c41a' },
          { level: 2, name: '基础', color: '#1890ff' },
          { level: 3, name: '进阶', color: '#faad14' },
          { level: 4, name: '高级', color: '#ff4d4f' },
          { level: 5, name: '专家', color: '#722ed1' }
        ],
        task_categories: ['基础组装', '传感器应用', '智能控制', '竞赛模拟'],
        default_points: 10,
        sort_order: 3,
        status: 'active',
        task_count: 0,
        student_count: 0
      }
    ];
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.projects = [];
    this.config = null;
    this.projectsLoaded = false;
    this.configLoaded = false;
  }
}

const projectService = ProjectService.getInstance();
module.exports = projectService;
