"""Server configuration for integration tests.

!! Never use this configuration in production because it
opens the server to the world and provide access to JupyterLab
JavaScript objects through the global window variable.
"""
from datetime import datetime, timezone

from jupyter_server.services.contents.checkpoints import AsyncCheckpoints
from jupyterlab.galata import configure_jupyter_server


class NoOpAsyncCheckpoints(AsyncCheckpoints):
    """Disable checkpoint persistence during integration tests.

    Why: opening a file triggers a background POST to /checkpoints. When the
    Playwright afterEach hook rmtree's the fixture directory before that
    request lands, jupyter_server's FileCheckpoints.checkpoint_model raises
    FileNotFoundError from os.stat and tornado serves a 500. Tests don't
    exercise checkpoint behavior, so swap in a no-op.
    """

    async def create_checkpoint(self, contents_mgr, path):
        return {"id": "noop", "last_modified": datetime.now(tz=timezone.utc)}

    async def restore_checkpoint(self, contents_mgr, checkpoint_id, path):
        pass

    async def rename_checkpoint(self, checkpoint_id, old_path, new_path):
        pass

    async def delete_checkpoint(self, checkpoint_id, path):
        pass

    async def list_checkpoints(self, path):
        return []


configure_jupyter_server(c)

c.ServerApp.jpserver_extensions = {
    "jupyterlab_speedy_unfold": True,
}

c.ContentsManager.checkpoints_class = NoOpAsyncCheckpoints

# Uncomment to set server log level to debug level
# c.ServerApp.log_level = "DEBUG"
