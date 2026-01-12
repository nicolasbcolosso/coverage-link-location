import { LightningElement, api, track, wire } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { NavigationMixin } from "lightning/navigation";
import { getObjectInfo } from "lightning/uiObjectInfoApi";
import OPPORTUNITY from "@salesforce/schema/Opportunity";
import saveNewQuoteWithCoverages from "@salesforce/apex/NewQuoteCoverageSelectionController.saveNewQuoteWithCoverages";
import fetchPickListValue from "@salesforce/apex/QuoteController.fetchPickListValue";
import getNameOpp from "@salesforce/apex/QuoteController.getNameOpp";
import isScaleOpp from "@salesforce/apex/QuoteController.isScaleOpp";

export default class NewQuoteInfo extends NavigationMixin(LightningElement) {
  @api recordId; // Opportunity Id
  @api selectedRaterType;
  @api coverageData; // Coverage data from newQuoteCoverageSelection

  // State
  isLoading = true;
  loadSpinner = false;
  isScale = false;

  // Quote fields
  @track quoteFields = new Map();
  @track statusOptions = [];
  @track picklistOptions = {};

  // Opportunity info
  oppName = "";
  oppUrl = "";

  // ==================== LIFECYCLE ====================

  connectedCallback() {
    this.loadInitialData();
  }

  // ==================== WIRE ====================

  @wire(getObjectInfo, { objectApiName: OPPORTUNITY })
  opportunityInfo;

  // ==================== DATA LOADING ====================

  async loadInitialData() {
    this.isLoading = true;
    try {
      // Get opportunity name
      this.oppName = await getNameOpp({ opp: this.recordId });
      this.oppUrl = "/" + this.recordId;

      // Check if Scale opportunity
      this.isScale = await isScaleOpp({ oppId: this.recordId });

      // Get picklist values
      await this.loadPicklistValues();
    } catch (error) {
      console.error("Error loading initial data:", error);
      this.showToast("Error", this.getErrorMessage(error), "error");
    } finally {
      this.isLoading = false;
    }
  }

  async loadPicklistValues() {
    try {
      // Get status picklist values
      const statusValues = await fetchPickListValue({
        objectType: "Quote__c",
        selectedField: "Status__c"
      });
      this.statusOptions = statusValues.map((val) => ({
        label: val,
        value: val
      }));

      // Get other picklist values as needed
      // This can be extended based on which fields need picklist values
    } catch (error) {
      console.error("Error loading picklist values:", error);
    }
  }

  // ==================== GETTERS ====================

  get isNewPropertyEnabled() {
    return this.coverageData?.isNewPropertyEnabled || false;
  }

  get raterType() {
    return this.coverageData?.raterType || this.selectedRaterType;
  }

  // ==================== EVENT HANDLERS ====================

  handleFieldChange(event) {
    const fieldName = event.target.name || event.target.dataset.fieldName;
    const value = event.target.value;
    this.quoteFields.set(fieldName, value);
  }

  handleCancel() {
    this.dispatchEvent(new CustomEvent("cancelevent"));
  }

  async handleSaveNewQuote() {
    // Validate required fields
    if (!this.validateForm()) {
      return;
    }

    this.loadSpinner = true;

    try {
      // Build quote fields object
      const quoteFieldsObj = {};
      this.quoteFields.forEach((value, key) => {
        quoteFieldsObj[key] = value;
      });

      console.log("quote fields data ==> ", quoteFieldsObj);

      // Build save request
      const saveRequest = {
        opportunityId: this.recordId,
        raterType: this.raterType,
        isNewPropertyEnabled: this.isNewPropertyEnabled,
        quoteFields: quoteFieldsObj,
        coverageFieldData: this.coverageData?.coverageFieldData || []
      };

      console.log("coverage field data ==> ", [
        ...saveRequest.coverageFieldData
      ]);

      console.log("save request ==> ", saveRequest);

      // Save quote with coverages
      const result = await saveNewQuoteWithCoverages({
        saveRequest: JSON.stringify(saveRequest)
      });

      if (result.isSuccess) {
        this.showToast("Success", "Quote created successfully", "success");

        // Navigate to the new Quote record
        this.dispatchEvent(
          new CustomEvent("infopage", {
            detail: result.quoteId
          })
        );
      } else {
        this.showToast("Error", result.message, "error");
        this.dispatchIndicationError(result.message);
      }
    } catch (error) {
      console.error("Error saving quote:", error);
      this.showToast("Error", this.getErrorMessage(error), "error");
      this.dispatchIndicationError(this.getErrorMessage(error));
    } finally {
      this.loadSpinner = false;
    }
  }

  // ==================== VALIDATION ====================

  validateForm() {
    const inputFields = this.template.querySelectorAll(
      "lightning-input, lightning-combobox, lightning-textarea"
    );
    let isValid = true;

    inputFields.forEach((field) => {
      if (!field.reportValidity()) {
        isValid = false;
      }
    });

    if (!isValid) {
      this.showToast(
        "Warning",
        "Please fill in all required fields.",
        "warning"
      );
    }

    return isValid;
  }

  // ==================== UTILITIES ====================

  dispatchIndicationError(message) {
    this.dispatchEvent(
      new CustomEvent("indicationerrorevent", {
        detail: {
          showToastError: true,
          showToastMessage: [message]
        }
      })
    );
  }

  getErrorMessage(error) {
    if (error.body && error.body.message) {
      return error.body.message;
    }
    if (error.message) {
      return error.message;
    }
    return "An unknown error occurred";
  }

  showToast(title, message, variant) {
    this.dispatchEvent(
      new ShowToastEvent({
        title,
        message,
        variant
      })
    );
  }
}
