// 引入第三方日历库
import Calendar from 'holiday-calendar';

// 默认配置项
const DEFAULT_CONFIG = {
  workdayStartHour: 9,       // 每天工作开始时间
  dailyWorkHours: 8,         // 每日工作时长
  taskInterval: 1,           // 任务间隔（小时）
  country: 'CN',             // 默认国家编码
};

export class Scheduler {
  constructor(config = {}) {
    // 合并配置
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 初始化日历实例
    this.calendar = new Calendar();
  }

  /* 核心方法 */
  // 调整到有效工作时间
  async adjustToWorkTime(timestamp) {
    let date = new Date(timestamp);
    date.setHours(this.config.workdayStartHour, 0, 0, 0);

    while (true) {
      const dayEnd = new Date(date);
      dayEnd.setHours(
        this.config.workdayStartHour + this.config.dailyWorkHours,
        0, 0, 0
      );

      const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
      const formattedDate = date.toLocaleDateString('en-CA', options);

      if (timestamp == 0) return timestamp;
      var isWorkday = await this.calendar.isWorkday(this.config.country, formattedDate)
      if (isWorkday) {
        if (timestamp < dayEnd) {
          return Math.max(timestamp, date.getTime());
        }
      }

      date.setDate(date.getDate() + 1);
      date.setHours(this.config.workdayStartHour, 0, 0, 0);
    }
  }

  // 计算单个任务结束时间
  async calculateTaskEnd(startTime, hours) {
    let current = await this.adjustToWorkTime(startTime);
    let remaining = hours * 3600000;

    while (remaining > 0) {
      const dayEnd = new Date(current);
      dayEnd.setHours(
        this.config.workdayStartHour + this.config.dailyWorkHours,
        0, 0, 0
      );

      const available = dayEnd - current;
      const deduct = Math.min(available, remaining);

      remaining -= deduct;
      current += deduct;

      if (remaining > 0) {
        current = await this.adjustToWorkTime(current);
      }
    }

    return current;
  }

  // 自动任务排期
  async scheduleTasks(tasks, initialStart) {
    const timelines = new Map();
    const initTimeline = async (person, start) => {
      if (!timelines.has(person)) {
        if (start == null || start == 0)
          start = initialStart
        timelines.set(person, {
          current: await this.adjustToWorkTime(start),
          tasks: []
        });
      }
      return timelines.get(person);
    };

    const scheduleTasks = async (tasks) => {
      const results = [];

      // 使用for循环顺序执行
      for (const task of tasks) {
        const result = await processSingleTask(task);
        results.push(result);
      }

      return results;
    };

    // 单独的任务处理方法
    const processSingleTask = async (task) => {
      const timeline = await initTimeline(task.person, task.startTime);

      let start, end, nextStart;
      if (task.manual) {
        start = task.startTime;
        end = task.endTime;
        nextStart = end > timeline.current ? end + this.config.taskInterval * 3600000 : timeline.current;
      } else {
        start = timeline.current;

        if (task.hours != 0) {
          end = await this.calculateTaskEnd(start, task.hours);
          nextStart = end + this.config.taskInterval * 3600000;
        } else {
          end = start;
        }
      };

      // 更新当前时间线
      timeline.current = await this.adjustToWorkTime(nextStart);
      // timelines.set(task.person, {
      //   current: await this.adjustToWorkTime(nextStart)
      // });

      return {
        ...task,
        startTime: start,
        endTime: end
      };
    }

    return await scheduleTasks(tasks);
  }
}

// 可选：快捷方法导出
export function createScheduler(config) {
  return new Scheduler(config);
}