import { Clipboard } from '@jupyterlab/apputils';
import { PageConfig } from '@jupyterlab/coreutils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { copyIcon, LabIcon } from '@jupyterlab/ui-components';
import { Widget } from '@lumino/widgets';

/**
 * CSS classes for the path bar and its parts.
 */
const CLASS = 'jp-jupyterlab-ext-pathbar-bar';
const PREFIX_CLASS = 'jp-jupyterlab-ext-pathbar-prefix';
const PATH_CLASS = 'jp-jupyterlab-ext-pathbar-path';
const BUTTON_CLASS = 'jp-jupyterlab-ext-pathbar-button';
const ICON_CLASS = 'jp-jupyterlab-ext-pathbar-icon';

/**
 * Placeholder shown in place of the (collapsed) absolute path prefix.
 */
const COLLAPSED_PREFIX = '.../';

/**
 * The absolute filesystem directory the server is rooted at, with no trailing
 * slash and no `~` abbreviation.
 *
 * `rootUri` is the fully qualified `file://` URI of the root (e.g.
 * `file:///Users/me/work`), so it is preferred over `serverRoot`, which the
 * server may report with `$HOME` contracted to `~`. Returns an empty string
 * when neither is available (no absolute path can then be shown).
 */
function rootDirectory(): string {
  const rootUri = PageConfig.getOption('rootUri');
  if (rootUri) {
    try {
      let dir = decodeURIComponent(new URL(rootUri).pathname);
      // Windows file URIs yield "/C:/..."; drop the leading slash.
      if (/^\/[A-Za-z]:\//.test(dir)) {
        dir = dir.slice(1);
      }
      return dir.replace(/\/+$/, '');
    } catch {
      // Malformed URI; fall back to serverRoot below.
    }
  }
  return PageConfig.getOption('serverRoot').replace(/\/+$/, '');
}

/**
 * Build a text-free, icon-only button with a tooltip.
 *
 * @param icon - The icon to render inside the button.
 * @param label - Tooltip and accessible label (there is no visible text).
 * @param onClick - Click handler.
 */
function makeIconButton(
  icon: LabIcon,
  label: string,
  onClick: () => void
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = BUTTON_CLASS;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.appendChild(icon.element({ tag: 'span', className: ICON_CLASS }));
  button.addEventListener('click', onClick);
  return button;
}

/**
 * A full-width bar showing a document's path.
 *
 * The path is shown relative to the JupyterLab root. A leading `.../` button
 * stands in for the absolute prefix (the server root); clicking it expands the
 * prefix to reveal the fully qualified path (and clicking again collapses it).
 * A leading, icon-only copy button copies whichever path is currently shown:
 * the relative path while collapsed, the absolute path while expanded.
 */
export class PathBar extends Widget {
  /**
   * @param context - The document context; source of the path and its changes.
   */
  constructor(context: DocumentRegistry.IContext<DocumentRegistry.IModel>) {
    super();
    this.addClass(CLASS);

    this._context = context;
    // The absolute server root; normally present but may be empty in some
    // deployments, in which case an absolute path is unavailable and the
    // prefix toggle is omitted.
    this._root = rootDirectory();

    // The copy button leads the bar; its label/action tracks the shown path.
    this._copy = makeIconButton(copyIcon, '', this._copyShownPath);
    this.node.appendChild(this._copy);

    if (this._root) {
      this._prefix = document.createElement('button');
      this._prefix.type = 'button';
      this._prefix.className = PREFIX_CLASS;
      this._prefix.addEventListener('click', this._togglePrefix);
      this.node.appendChild(this._prefix);
    }

    this._path = document.createElement('span');
    this._path.className = PATH_CLASS;
    this.node.appendChild(this._path);

    context.pathChanged.connect(this._render, this);
    this._render();
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._context.pathChanged.disconnect(this._render, this);
    super.dispose();
  }

  /**
   * The document path relative to the JupyterLab root.
   */
  private get _relativePath(): string {
    return this._context.path;
  }

  /**
   * The fully qualified document path, or the relative path when no server
   * root is known.
   */
  private get _absolutePath(): string {
    return this._root
      ? `${this._root}/${this._context.path}`
      : this._context.path;
  }

  /**
   * Toggle the absolute-prefix between collapsed (`.../`) and expanded.
   */
  private _togglePrefix = (): void => {
    this._expanded = !this._expanded;
    this._render();
  };

  /**
   * Copy the currently shown path: absolute while the prefix is expanded,
   * relative otherwise.
   */
  private _copyShownPath = (): void => {
    Clipboard.copyToSystem(
      this._expanded ? this._absolutePath : this._relativePath
    );
  };

  /**
   * Refresh the displayed path and controls from the context and prefix state.
   */
  private _render(): void {
    this._path.textContent = this._relativePath;
    // Hovering the bar reveals the fully qualified path regardless of state.
    this.node.title = this._absolutePath;

    const copyLabel = this._expanded
      ? 'Copy absolute path'
      : 'Copy relative path';
    this._copy.title = copyLabel;
    this._copy.setAttribute('aria-label', copyLabel);

    if (this._prefix) {
      this._prefix.textContent = this._expanded
        ? `${this._root}/`
        : COLLAPSED_PREFIX;
      this._prefix.title = this._expanded ? 'Hide full path' : 'Show full path';
    }
  }

  private readonly _context: DocumentRegistry.IContext<DocumentRegistry.IModel>;
  private readonly _root: string;
  private _copy: HTMLButtonElement;
  private _prefix: HTMLButtonElement | null = null;
  private _path: HTMLSpanElement;
  private _expanded = false;
}
