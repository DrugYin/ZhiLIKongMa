function canStudentAccessTask(task, joinedClassIds = []) {
  if (!task || task.is_deleted || task.status !== 'published') {
    return false
  }

  if (task.task_type === 'public') {
    return true
  }

  if (task.task_type === 'class' && task.visibility === 'public') {
    return true
  }

  return task.task_type === 'class'
    && task.visibility === 'class_only'
    && joinedClassIds.includes(task.class_id)
}

module.exports = {
  canStudentAccessTask
}
