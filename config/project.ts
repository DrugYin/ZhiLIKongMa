/**
 * 项目配置服务
 */

import { configApi } from '../services/api';
import { setProjects, getProjects, setConfig, getConfig } from '../services/storage';
import { PROJECT_CODES, PROJECT_NAMES } from '../utils/constant';

export interface ProjectInfo {
  _id: string;
  project_name: string;
  project_code: string;
  description: string;
  cover_image: string;
  icon: string;
  difficulty_levels: Array<{
    level: number;
    name: string;
    color: string;
  }>;
  task_categories: string[];
  default_points: number;
  sort_order: number;
  status: string;
  task_count: number;
  student_count: number;
}

export interface SystemConfig {
  points_register_gift: number;
  points_per_task: number;
  points_daily_limit: number;
  lottery_enabled: boolean;
  lottery_cost_points: number;
  lottery_daily_limit: number;
  class_max_members: number;
  class_join_need_approval: boolean;
  task_max_submissions: number;
  task_overtime_penalty: number;
}

class ProjectService {
  private static instance: ProjectService;
  private projects: ProjectInfo[] = [];
  private config: SystemConfig | null = null;
  private projectsLoaded = false;
  private configLoaded = false;

  static getInstance(): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService();
    }
    return ProjectService.instance;
  }

  /**
   * 获取项目列表
   */
  async getProjects(forceRefresh = false): Promise<ProjectInfo[]> {
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
  async getProjectById(projectId: string): Promise<ProjectInfo | null> {
    const projects = await this.getProjects();
    return projects.find(p => p._id === projectId) || null;
  }

  /**
   * 根据 code 获取项目
   */
  async getProjectByCode(projectCode: string): Promise<ProjectInfo | null> {
    const projects = await this.getProjects();
    return projects.find(p => p.project_code === projectCode) || null;
  }

  /**
   * 获取项目选项（用于下拉选择）
   */
  async getProjectOptions(): Promise<Array<{ label: string; value: string }>> {
    const projects = await this.getProjects();
    return projects.map(p => ({
      label: p.project_name,
      value: p._id
    }));
  }

  /**
   * 获取项目难度选项
   */
  async getDifficultyOptions(projectId: string): Promise<Array<{ label: string; value: number; color: string }>> {
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
  async getCategoryOptions(projectId: string): Promise<string[]> {
    const project = await this.getProjectById(projectId);
    return project?.task_categories || [];
  }

  /**
   * 获取系统配置
   */
  async getConfig(forceRefresh = false): Promise<SystemConfig> {
    if (!forceRefresh && this.configLoaded && this.config) {
      return this.config;
    }

    // 先尝试从缓存获取
    if (!forceRefresh) {
      const cached = getConfig();
      if (cached) {
        this.config = cached as SystemConfig;
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
  private parseConfig(configArray: any[]): SystemConfig {
    const config: Partial<SystemConfig> = {};
    configArray.forEach((item: any) => {
      (config as any)[item.key] = item.value;
    });
    return { ...this.getDefaultConfig(), ...config };
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): SystemConfig {
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
  private getDefaultProjects(): ProjectInfo[] {
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
  clearCache(): void {
    this.projects = [];
    this.config = null;
    this.projectsLoaded = false;
    this.configLoaded = false;
  }
}

export const projectService = ProjectService.getInstance();
export default projectService;