const worker = new Worker(new URL('./search-worker.js', import.meta.url), {
  type: 'module'
});
let next = 0;
const pending = new Map();
worker.onmessage = ({
  data
}) => {
  if (data.requestId) {
    pending.get(data.requestId)?.(data);
    pending.delete(data.requestId);
  }
};
export const initialize = records => worker.postMessage({
  op: 'init',
  records
});
export const update = record => worker.postMessage({
  op: 'put',
  record
});
export const remove = id => worker.postMessage({
  op: 'remove',
  id
});
export const search = options => new Promise(resolve => {
  const requestId = ++next;
  pending.set(requestId, resolve);
  worker.postMessage({
    op: 'search',
    requestId,
    ...options
  });
});
