/**
 * API 调用封装
 */

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error_code?: number;
  total?: number;
  page?: number;
  page_size?: number;
}

interface RequestConfig {
  name: string;
  data?: Record<string, any>;
  timeout?: number;
}

/**
 * 调用云函数
 */
export async function callFunction<T = any>(config: RequestConfig): Promise<ApiResponse<T>> {
  try {
    const res = await wx.cloud.callFunction({
      name: config.name,
      data: config.data || {}
    });

    const result = res.result as ApiResponse<T>;
    
    if (!result.success) {
      console.error(`[API Error] ${config.name}:`, result.message);
    }

    return result;
  } catch (error: any) {
    console.error(`[API Exception] ${config.name}:`, error);
    return {
      success: false,
      message: error.message || '网络请求失败',
      error_code: -1
    };
  }
}

/**
 * 用户相关 API
 */
export const userApi = {
  login() {
    return callFunction({ name: 'login' });
  },

  register(data: {
    user_name: string;
    phone: string;
    school?: string;
    grade?: string;
    avatar_url?: string;
    nick_name?: string;
  }) {
    return callFunction({ name: 'register', data });
  },

  getUserInfo() {
    return callFunction({ name: 'get-user-info' });
  },

  updateUser(data: {
    user_name?: string;
    phone?: string;
    school?: string;
    grade?: string;
    birthday?: string;
    address?: string;
    avatar_url?: string;
  }) {
    return callFunction({ name: 'update-user', data });
  },

  switchRole(role: 'student' | 'teacher') {
    return callFunction({ name: 'switch-role', data: { role } });
  },

  applyTeacher(data: { subject: string; project: string; title?: string }) {
    return callFunction({ name: 'apply-teacher', data });
  }
};

/**
 * 班级相关 API
 */
export const classApi = {
  createClass(data: {
    class_name: string;
    description?: string;
    project_id: string;
    max_members?: number;
    class_time?: string;
    location?: string;
    cover_image?: string;
  }) {
    return callFunction({ name: 'create-class', data });
  },

  getClasses(data: {
    role: 'teacher' | 'student';
    project_id?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }) {
    return callFunction({ name: 'get-classes', data });
  },

  getClassDetail(class_id: string) {
    return callFunction({ name: 'get-class-detail', data: { class_id } });
  },

  joinClass(class_code: string, apply_reason?: string) {
    return callFunction({ name: 'join-class', data: { class_code, apply_reason } });
  },

  handleApplication(data: {
    application_id: string;
    action: 'approve' | 'reject';
    remark?: string;
  }) {
    return callFunction({ name: 'handle-join-application', data });
  }
};

/**
 * 任务相关 API
 */
export const taskApi = {
  createTask(data: {
    title: string;
    description: string;
    cover_image?: string;
    images?: string[];
    files?: Array<{ file_id: string; file_name: string; file_size: number }>;
    project_id: string;
    category?: string;
    difficulty: number;
    points: number;
    deadline_date: string;
    deadline_time: string;
    class_id?: string;
    require_images?: boolean;
    require_description?: boolean;
    max_submissions?: number;
  }) {
    return callFunction({ name: 'create-task', data });
  },

  getTasks(data: {
    role: 'teacher' | 'student';
    project_id?: string;
    class_id?: string;
    status?: string;
    keyword?: string;
    page?: number;
    page_size?: number;
  }) {
    return callFunction({ name: 'get-tasks', data });
  },

  getTaskDetail(task_id: string) {
    return callFunction({ name: 'get-task-detail', data: { task_id } });
  },

  submitTask(data: {
    task_id: string;
    description?: string;
    images?: string[];
    files?: Array<{ file_id: string; file_name: string }>;
  }) {
    return callFunction({ name: 'submit-task', data });
  },

  reviewSubmission(data: {
    submission_id: string;
    action: 'approve' | 'reject';
    score?: number;
    feedback?: string;
    feedback_images?: string[];
  }) {
    return callFunction({ name: 'review-submission', data });
  },

  getSubmissions(data: {
    role: 'teacher' | 'student';
    task_id?: string;
    class_id?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }) {
    return callFunction({ name: 'get-submissions', data });
  }
};

/**
 * 抽奖相关 API
 */
export const lotteryApi = {
  getPrizes() {
    return callFunction({ name: 'get-prizes' });
  },

  startDraw() {
    return callFunction({ name: 'start-draw' });
  },

  getDrawRecords(data?: { page?: number; page_size?: number }) {
    return callFunction({ name: 'get-draw-records', data });
  }
};

/**
 * 排行榜相关 API
 */
export const rankingApi = {
  getRanking(data: {
    type: 'points' | 'tasks';
    class_id?: string;
    limit?: number;
  }) {
    return callFunction({ name: 'get-ranking', data });
  }
};

/**
 * 配置相关 API
 */
export const configApi = {
  getConfig(data?: { keys?: string[]; category?: string }) {
    return callFunction({ name: 'get-config', data });
  },

  getProjects(data?: { status?: 'active' | 'all' }) {
    return callFunction({ name: 'get-projects', data });
  }
};

export default {
  callFunction,
  userApi,
  classApi,
  taskApi,
  lotteryApi,
  rankingApi,
  configApi
};