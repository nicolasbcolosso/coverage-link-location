import { LightningElement, api } from "lwc";
import { CloseActionScreenEvent } from "lightning/actions";
import checkIsNewPropertyEnabled from "@salesforce/apex/CoverageSelectionController.checkIsNewPropertyEnabled";

/**
 * @description Router component that determines which coverage selection component to render
 * based on the Is_New_Property__c field value on the parent record (Policy__c or Endorsement__c).
 * This component is used as a Screen Action on Policy__c and Endorsement__c record pages.
 */
export default class CoverageSelectionRouter extends LightningElement {
  _recordId;

  @api
  set recordId(value) {
    this._recordId = value;
    if (value) {
      this.checkPropertyFlag();
    }
  }
  get recordId() {
    return this._recordId;
  }

  // State management
  isLoading = true;
  hasError = false;
  errorMessage = "";
  isNewPropertyEnabled = false;
  isInitialized = false;

  // ==================== GETTERS ====================

  /**
   * @description Returns true if the new coverageSelection component should be rendered
   */
  get showNewComponent() {
    return this.isInitialized && this.isNewPropertyEnabled;
  }

  /**
   * @description Returns true if the old lightningAddRemoveCoverage component should be rendered
   */
  get showOldComponent() {
    return this.isInitialized && !this.isNewPropertyEnabled;
  }

  /**
   * @description Returns true if the component is ready to render (not loading and no error)
   */
  get isReady() {
    return !this.isLoading && !this.hasError;
  }

  // ==================== INITIALIZATION ====================

  /**
   * @description Checks the Is_New_Property__c flag on the parent record
   * to determine which component to render
   */
  async checkPropertyFlag() {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = "";

    try {
      const result = await checkIsNewPropertyEnabled({
        recordId: this._recordId
      });

      this.isNewPropertyEnabled = result;
      this.isInitialized = true;
    } catch (error) {
      console.error("Error checking Is_New_Property__c flag:", error);
      this.hasError = true;
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.isLoading = false;
    }
  }

  // ==================== EVENT HANDLERS ====================

  /**
   * @description Handles the cancel event from child components
   * Closes the action screen
   */
  handleCancel() {
    this.dispatchEvent(new CloseActionScreenEvent());
  }

  /**
   * @description Handles the save/reload event from child components
   * Propagates the event and closes the action screen
   */
  handleSaveLimit(event) {
    // Propagate the event to any parent listeners
    this.dispatchEvent(
      new CustomEvent("savelimit", {
        detail: event.detail
      })
    );
    // Close the action screen after successful save
    this.dispatchEvent(new CloseActionScreenEvent());
  }

  /**
   * @description Handles the reload view page event from child components
   */
  handleReloadViewPage(event) {
    this.dispatchEvent(
      new CustomEvent("reloadviewpage", {
        detail: event.detail
      })
    );
  }

  /**
   * @description Handles retry button click when there's an error
   */
  handleRetry() {
    this.checkPropertyFlag();
  }

  /**
   * @description Handles close button click when there's an error
   */
  handleClose() {
    this.dispatchEvent(new CloseActionScreenEvent());
  }

  // ==================== UTILITIES ====================

  /**
   * @description Extracts error message from various error formats
   * @param {Object} error - The error object
   * @returns {String} The error message
   */
  getErrorMessage(error) {
    if (error.body && error.body.message) {
      return error.body.message;
    }
    if (error.message) {
      return error.message;
    }
    return "An unknown error occurred. Please try again.";
  }
}
