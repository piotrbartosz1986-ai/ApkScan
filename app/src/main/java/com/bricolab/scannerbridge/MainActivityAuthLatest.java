package com.bricolab.scannerbridge;

/**
 * AUTH LATEST uses the proven MainActivityV36 scanner/camera core unchanged.
 * The build pins MainActivity's REMOTE_BASE to the converter-capable AUTH branch,
 * so there is only one WebView loader and no race with the old main-branch UI.
 */
public class MainActivityAuthLatest extends MainActivityV36 {
}
