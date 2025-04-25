self.MonacoEnvironment = {
  getWorkerUrl: function (moduleId, label) {
    return './monaco-workers/' + label + '.worker.js';
  }
};