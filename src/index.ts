/* eslint-disable @typescript-eslint/ban-ts-comment */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

import { IDocumentManager } from '@jupyterlab/docmanager';

import { MainAreaWidget, WidgetTracker } from '@jupyterlab/apputils';

import { DocumentRegistry, IDocumentWidget } from '@jupyterlab/docregistry';

import { DisposableDelegate, IDisposable } from '@lumino/disposable';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { ITranslator } from '@jupyterlab/translation';

import { IStateDB } from '@jupyterlab/statedb';

import { FileTreeBrowser, FilterFileTreeBrowserModel } from './unfold';

import { PathBar } from './widgets/PathBar';

const SETTINGS_ID =
  'jupyterlab-speedy-unfold:jupyterlab-speedy-unfold-settings';

/**
 * The file browser namespace token.
 */
const namespace = 'filebrowser';

const fileBrowserFactory: JupyterFrontEndPlugin<IFileBrowserFactory> = {
  id: 'jupyterlab-speedy-unfold:FileBrowserFactory',
  provides: IFileBrowserFactory,
  requires: [IDocumentManager, ITranslator, ISettingRegistry],
  optional: [IStateDB],
  activate: async (
    app: JupyterFrontEnd,
    docManager: IDocumentManager,
    translator: ITranslator,
    settings: ISettingRegistry,
    state: IStateDB | null
  ): Promise<IFileBrowserFactory> => {
    const setting = await settings.load(SETTINGS_ID);

    const tracker = new WidgetTracker<FileTreeBrowser>({ namespace });
    const createFileBrowser = (
      id: string,
      options: IFileBrowserFactory.IOptions = {}
    ) => {
      const model = new FilterFileTreeBrowserModel({
        translator: translator,
        auto: options.auto ?? true,
        manager: docManager,
        driveName: options.driveName || '',
        refreshInterval: options.refreshInterval,
        state:
          options.state === null
            ? undefined
            : options.state || state || undefined
      });
      const widget = new FileTreeBrowser({
        id,
        model,
        restore: true,
        translator,
        app
      });

      widget.listing.singleClickToUnfold = setting.get('singleClickToUnfold')
        .composite as boolean;

      setting.changed.connect(() => {
        widget.listing.singleClickToUnfold = setting.get('singleClickToUnfold')
          .composite as boolean;
      });

      // check the url in iframe and open
      app.restored.then(async () => {
        const windowPathname = window.location.pathname;
        const treeIndex = windowPathname.indexOf('/tree/');
        let path = windowPathname.substring(treeIndex + '/tree/'.length);
        path = decodeURIComponent(path);
        const content = await app.serviceManager.contents.get(path);
        if (content.type !== 'directory') {
          docManager.open(path);
        }
      });

      // Track the newly created file browser.
      void tracker.add(widget);

      return widget;
    };

    // @ts-ignore: DirListing._onPathChanged is private upstream, need to change this so we can remove the ignore
    return { createFileBrowser, tracker };
  }
};

/**
 * A widget extension that inserts a full-width {@link PathBar} directly above
 * the content of any document widget (notebook, text editor, image viewer,
 * CSV, ...).
 *
 * A single instance is registered against every concrete widget factory (see
 * {@link pathBar}); each document type derives from `DocumentWidget`
 * (a `MainAreaWidget`) and exposes a `context` carrying `path` / `pathChanged`.
 */
class PathBarExtension
  implements
    DocumentRegistry.IWidgetExtension<IDocumentWidget, DocumentRegistry.IModel>
{
  createNew(
    widget: IDocumentWidget,
    context: DocumentRegistry.IContext<DocumentRegistry.IModel>
  ): IDisposable {
    const bar = new PathBar(context);

    // `MainAreaWidget.contentHeader` is a BoxPanel purpose-built for widgets
    // that sit between the toolbar and the content, so the bar lands directly
    // above the editor/viewer without any layout-index assumptions.
    if (widget instanceof MainAreaWidget) {
      widget.contentHeader.addWidget(bar);
    } else {
      // No known place to attach the bar; drop it rather than leak the node.
      bar.dispose();
    }

    return new DisposableDelegate(() => {
      bar.dispose();
    });
  }
}

/**
 * Plugin adding the path bar above every document widget's content.
 *
 * The document registry has no `'*'` wildcard for widget extensions: they are
 * stored and looked up per concrete (lowercased) factory name. Register the
 * extension against every existing factory, and against any added later.
 */
const pathBar: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-speedy-unfold:path-bar',
  description: "Show the document's path above the content editor/viewer.",
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    const { docRegistry } = app;
    const extension = new PathBarExtension();

    for (const factory of docRegistry.widgetFactories()) {
      docRegistry.addWidgetExtension(factory.name, extension);
    }

    docRegistry.changed.connect((_, args) => {
      if (
        args.type === 'widgetFactory' &&
        args.change === 'added' &&
        args.name
      ) {
        docRegistry.addWidgetExtension(args.name, extension);
      }
    });
  }
};

export * from './unfold';

export default [fileBrowserFactory, pathBar];
