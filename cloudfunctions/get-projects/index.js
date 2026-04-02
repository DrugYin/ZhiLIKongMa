const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

function getDefaultProjects() {
  return [
    {
      project_name: '编程',
      project_code: 'programming',
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
      bonus_multiplier: 1,
      sort_order: 1,
      status: 'active',
      is_default: true,
      task_count: 0,
      student_count: 0
    },
    {
      project_name: '无人机',
      project_code: 'drone',
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
      bonus_multiplier: 1,
      sort_order: 2,
      status: 'active',
      is_default: true,
      task_count: 0,
      student_count: 0
    },
    {
      project_name: '机器人',
      project_code: 'robot',
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
      bonus_multiplier: 1,
      sort_order: 3,
      status: 'active',
      is_default: true,
      task_count: 0,
      student_count: 0
    }
  ]
}

function filterProjects(projects, status) {
  if (!status) {
    return projects
  }

  return projects.filter((item) => item.status === status)
}

exports.main = async (event) => {
  try {
    const status = String(event.status || '').trim()
    let projects = []
    let source = 'database'

    try {
      const collection = db.collection('projects')
      const res = status
        ? await collection.where({ status }).orderBy('sort_order', 'asc').get()
        : await collection.orderBy('sort_order', 'asc').get()

      projects = res.data || []
    } catch (dbError) {
      console.warn('[get-projects] fallback to default projects:', dbError.message)
    }

    if (!projects.length) {
      projects = filterProjects(getDefaultProjects(), status)
      source = 'default'
    }

    return {
      success: true,
      message: '获取项目列表成功',
      data: projects,
      total: projects.length,
      source
    }
  } catch (error) {
    console.error('[get-projects] Error:', error)
    return {
      success: false,
      message: '获取项目列表失败',
      error: error.message,
      error_code: 500
    }
  }
}
