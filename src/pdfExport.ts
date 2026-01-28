import * as vscode from 'vscode';
import { PdfExportService, PdfExportConfig, PdfExportEvents } from './core/pdfExportService';
import { VSCodeLogger } from './vscode/vscodeLogger';
import { getQuarkdownConfig } from './config';
import { getActiveQuarkdownDocument } from './utils';
import { Strings } from './strings';

/**
 * Export the active .qd file to PDF using VS Code integration.
 * Provides user feedback through VS Code's notification system.
 */
export async function exportToPDF(): Promise<void> {
    const document = getActiveQuarkdownDocument();
    if (!document) {
        vscode.window.showWarningMessage(Strings.openQuarkdownFirst);
        return;
    }

    if (document.isDirty && !(await document.save())) {
        vscode.window.showErrorMessage(Strings.saveBeforeExport);
        return;
    }

    const config = getQuarkdownConfig();
    const logger = new VSCodeLogger('Quarkdown PDF Export');

    const exportConfig: PdfExportConfig = {
        executablePath: config.executablePath,
        filePath: document.fileName,
        outputDirectory: config.outputDirectory,
        logger: logger
    };

    const exportService = new PdfExportService();

    // Show initial progress message
    vscode.window.showInformationMessage(Strings.exportInProgress);

    const events: PdfExportEvents = {
        onSuccess: () => {
            vscode.window.showInformationMessage(Strings.exportSucceeded);
            logger.dispose();
        },
        onError: (error) => {
            logger.error(error);
            logger.show?.();

            const lowerError = error.toLowerCase();
            if (lowerError.includes('quarkdown not found')) {
                void vscode.window.showErrorMessage(
                    error,
                    Strings.exportInstallHint,
                    Strings.exportOpenSettings
                ).then((selection?: string) => {
                    if (selection === Strings.exportOpenSettings) {
                        void vscode.commands.executeCommand('workbench.action.openSettings', 'quarkdown.path');
                    }
                });
                return;
            }

            if (lowerError.includes('pdf was not created') || lowerError.includes('output pdf')) {
                vscode.window.showErrorMessage(`${error}. ${Strings.exportInstallHint}`);
                return;
            }

            if (lowerError.includes('exit code')) {
                void vscode.window.showErrorMessage(
                    `${Strings.exportFailed}: ${error}`,
                    Strings.exportViewOutput
                ).then((selection?: string) => {
                    if (selection === Strings.exportViewOutput) {
                        logger.show?.();
                    }
                });
                return;
            }

            vscode.window.showErrorMessage(`${Strings.exportFailed}: ${error}`);
        }
        // onProgress events are automatically logged by the service
    };

    try {
        await exportService.exportToPdf(exportConfig, events);
    } catch (error) {
        const errorMessage = `Export failed: ${error}`;
        vscode.window.showErrorMessage(errorMessage);
        logger.error(errorMessage);
        logger.show?.();
        logger.dispose();
    }
}
