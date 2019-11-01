import { Logger } from './logger';

/**
 * Promise queue and parallel queue helpers
 */
export class PromiseHelper {
  /**
   * Execute promises one after the other
   * @param queue - list of promise functions to be executed
   */
  public static promiseQueue = async <T>(queue: (() => Promise<T>)[], logger: Logger): Promise<(T | void)[]> => {
    if (!queue.length) return [];

    const queueClone = [...queue];
    const toExecute = queueClone.shift();

    const executionResoult = await toExecute().catch(e => logger.error(e));
    return [
      executionResoult,
      ...((await PromiseHelper.promiseQueue(queueClone, logger).catch(e => logger.error(e))) || [])
    ];
  };

  /**
   * Execute promises with limited parallel jobs
   * @param queue - list of promise functions to be executed
   * @param parallelNumber - number of parallel queues
   */
  public static promiseParallelQueue = async <T>(
    queue: (() => Promise<T>)[],
    parallelNumber: number,
    logger: Logger
  ) => {
    const queues: (() => Promise<T>)[][] = [];
    for (let i = 0; i < parallelNumber; i++) queues.push([]);

    let row = 0;
    queue.forEach(q => {
      queues[row].push(q);
      row++;
      if (row >= parallelNumber) row = 0;
    });

    const globalQueue = await Promise.all(
      queues.map(async q => (await PromiseHelper.promiseQueue(q, logger).catch(e => logger.error(e))) || [])
    ).catch(e => logger.error(e));
    if (!globalQueue) return [];

    return globalQueue.flat();
  };
}
