import { LightningElement, api, track, wire } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { NavigationMixin } from "lightning/navigation";
import { getObjectInfo } from "lightning/uiObjectInfoApi";
import OPPORTUNITY from "@salesforce/schema/Opportunity";
import saveNewQuoteWithCoverages from "@salesforce/apex/NewQuoteCoverageSelectionController.saveNewQuoteWithCoverages";
import fetchPickListValue from "@salesforce/apex/QuoteController.fetchPickListValue";
import fetchPickListEntries from "@salesforce/apex/QuoteController.fetchPickListEntries";
import getNameOpp from "@salesforce/apex/QuoteController.getNameOpp";
import isScaleOpp from "@salesforce/apex/QuoteController.isScaleOpp";
import isHBOpp from "@salesforce/apex/QuoteController.isHBOpp";
import apexSearch from "@salesforce/apex/QuoteController.search";
import apexSearchAcc from "@salesforce/apex/QuoteController.searchAcc";

export default class NewQuoteInfo extends NavigationMixin(LightningElement) {
  @api recordId; // Opportunity Id
  @api selectedRaterType;
  @api coverageData; // Coverage data from newQuoteCoverageSelection

  // State
  isLoading = true;
  loadSpinner = false;
  isScale = false;
  isHB = false;

  // Quote fields
  @track quoteFields = new Map();

  // Picklist options
  @track statusOptions = [];
  @track formTypeField = [];
  @track admittedField = [];
  @track retroField = [];
  @track followFormField = [];
  @track PFA_Type = [];

  // Opportunity info
  oppName = "";
  oppUrl = "";

  // Lookup selections
  @track initialSelection = [];
  @track secondaryInitialSelection = [];
  @track carrierInitialSelection = [];
  @track producerInitialSelection = [];

  // Lookup errors
  errors = [];
  secondaryErrors = [];
  carrierErrors = [];
  producerErrors = [];

  // Modal state
  @track isModalOpen = false;
  @track modalType = "";
  @track contacts = [];
  @track contactsSearch = "";

  // Feature flags
  isAdditionalInfo = true;
  PFA_TypeView = true;

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

      // Check if HB opportunity
      this.isHB = await isHBOpp({ oppId: this.recordId });

      // Set Opportunity__c in quoteFields
      this.quoteFields.set("Opportunity__c", this.recordId);

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

      // Get Form Type picklist values
      const formTypeValues = await fetchPickListEntries({
        objectType: "Quote__c",
        selectedField: "Form_Type__c"
      });
      this.formTypeField = formTypeValues;

      // Get Admitted picklist values
      const admittedValues = await fetchPickListEntries({
        objectType: "Quote__c",
        selectedField: "Admitted__c"
      });
      this.admittedField = admittedValues;

      // Get Retro Date Type picklist values
      const retroValues = await fetchPickListEntries({
        objectType: "Quote__c",
        selectedField: "Retro_Date_Type__c"
      });
      this.retroField = retroValues;

      // Get Follow Form picklist values
      const followFormValues = await fetchPickListEntries({
        objectType: "Quote__c",
        selectedField: "Follow_Form__c"
      });
      this.followFormField = followFormValues;

      // Get PFA Type picklist values
      const pfaTypeValues = await fetchPickListEntries({
        objectType: "Quote__c",
        selectedField: "PFA_Type__c"
      });
      this.PFA_Type = pfaTypeValues;
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

  get isMultiEntry() {
    return false;
  }

  // ==================== EVENT HANDLERS ====================

  handleFieldChange(event) {
    const fieldName = event.target.name || event.target.dataset.fieldName;
    let value = event.target.value;

    // Handle checkbox
    if (event.target.type === "checkbox") {
      value = event.target.checked;
    }

    this.quoteFields.set(fieldName, value);
  }

  handleFieldChangeCheck(event) {
    const fieldName = event.target.name || event.target.dataset.fieldName;
    const value = event.target.checked;
    this.quoteFields.set(fieldName, value);
  }

  handleCancel() {
    this.dispatchEvent(new CustomEvent("cancelevent"));
  }

  // ==================== LOOKUP HANDLERS ====================

  handleSearch(event) {
    apexSearch(event.detail)
      .then((results) => {
        this.template
          .querySelector('[data-id="lookupMarketer"]')
          .setSearchResults(results);
      })
      .catch((error) => {
        this.showToast(
          "Lookup Error",
          "An error occurred while searching.",
          "error"
        );
        this.errors = [error];
      });
  }

  handleSearchSecondary(event) {
    apexSearch(event.detail)
      .then((results) => {
        this.template
          .querySelector('[data-id="lookupSecondaryMarketer"]')
          .setSearchResults(results);
      })
      .catch((error) => {
        this.showToast(
          "Lookup Error",
          "An error occurred while searching.",
          "error"
        );
        this.secondaryErrors = [error];
      });
  }

  handleSearchAcc(event) {
    apexSearchAcc(event.detail)
      .then((results) => {
        this.template
          .querySelector('[data-id="lookupCarrier"]')
          .setSearchResultsAcc(results);
      })
      .catch((error) => {
        this.showToast(
          "Lookup Error",
          "An error occurred while searching.",
          "error"
        );
        this.carrierErrors = [error];
      });
  }

  handleSearchProducer(event) {
    apexSearch(event.detail)
      .then((results) => {
        this.template
          .querySelector('[data-id="lookupProducer"]')
          .setSearchResults(results);
      })
      .catch((error) => {
        this.showToast(
          "Lookup Error",
          "An error occurred while searching.",
          "error"
        );
        this.producerErrors = [error];
      });
  }

  handleSelectionChange(event) {
    const apiname = event.target.dataset.apiname;
    const valueField = event.detail;
    try {
      if (valueField && valueField.length > 0) {
        this.quoteFields.set(apiname, valueField[0].id);
      }
    } catch (error) {
      console.log(error);
    }
  }

  handleSelectionChangeAcc(event) {
    const apiname = event.target.dataset.apiname;
    const valueField = event.detail;
    try {
      if (valueField && valueField.length > 0) {
        this.quoteFields.set(apiname, valueField[0].id);
      }
    } catch (error) {
      console.log(error);
    }
  }

  // ==================== MODAL HANDLERS ====================

  openModal(event) {
    this.modalType = event.detail;
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.contacts = [];
    this.contactsSearch = "";
  }

  updateSeachKey(event) {
    this.contactsSearch = event.target.value;
  }

  modalSearch() {
    apexSearch({ searchTerm: this.contactsSearch })
      .then((results) => {
        this.contacts = results;
      })
      .catch((error) => {
        console.error(error);
      });
  }

  modalSearchAcc() {
    apexSearchAcc({ searchTerm: this.contactsSearch })
      .then((results) => {
        this.contacts = results;
      })
      .catch((error) => {
        console.error(error);
      });
  }

  selectItem(event) {
    const itemId = event.currentTarget.id.slice(0, -4);
    const itemName = event.currentTarget.dataset.name;
    const itemSubtitle = event.currentTarget.dataset.subtitle;

    if (this.modalType === "Marketer_UW_Name__c") {
      this.initialSelection = [
        {
          id: itemId,
          sObjectType: "Contact",
          icon: "standard:contact",
          title: itemName,
          subtitle: itemSubtitle
        }
      ];
      this.quoteFields.set("Marketer_UW_Name__c", itemId);
      this.errors = [];
    } else if (this.modalType === "Secondary_Marketer_UW_Name__c") {
      this.secondaryInitialSelection = [
        {
          id: itemId,
          sObjectType: "Contact",
          icon: "standard:contact",
          title: itemName,
          subtitle: itemSubtitle
        }
      ];
      this.quoteFields.set("Secondary_Marketer_UW_Name__c", itemId);
      this.secondaryErrors = [];
    } else if (this.modalType === "Producer_Name__c") {
      this.producerInitialSelection = [
        {
          id: itemId,
          sObjectType: "Contact",
          icon: "standard:contact",
          title: itemName,
          subtitle: itemSubtitle
        }
      ];
      this.quoteFields.set("Producer_Name__c", itemId);
      this.producerErrors = [];
    }

    this.closeModal();
  }

  selectItemAcc(event) {
    const itemId = event.currentTarget.id.slice(0, -4);
    const itemName = event.currentTarget.dataset.name;
    const itemSubtitle = event.currentTarget.dataset.subtitle;

    this.carrierInitialSelection = [
      {
        id: itemId,
        sObjectType: "Account",
        icon: "standard:account",
        title: itemName,
        subtitle: itemSubtitle
      }
    ];
    this.quoteFields.set("Carrier_Issuing_Company__c", itemId);
    this.carrierErrors = [];
    this.closeModal();
  }

  // ==================== SAVE HANDLER ====================

  async handleSaveNewQuote() {
    // Validate required fields
    if (!this.validateForm()) {
      return;
    }

    this.loadSpinner = true;

    try {
      // Build quote fields object - convert Map to plain object with string values
      const quoteFieldsObj = {};
      this.quoteFields.forEach((value, key) => {
        // Convert all values to strings for the Apex controller
        if (value !== null && value !== undefined) {
          quoteFieldsObj[key] = String(value);
        }
      });

      console.log("quote fields data ==> ", quoteFieldsObj);
      console.log("coverage data ==> ", this.coverageData);

      // Build save request
      const saveRequest = {
        opportunityId: this.recordId,
        raterType: this.raterType,
        isNewPropertyEnabled: this.isNewPropertyEnabled,
        quoteFields: quoteFieldsObj,
        coverageFieldData: this.coverageData?.coverageFieldData || []
      };

      console.log("save request ==> ", JSON.stringify(saveRequest));

      // Save quote with coverages
      const result = await saveNewQuoteWithCoverages({
        saveRequest: JSON.stringify(saveRequest)
      });

      console.log("save result ==> ", result);

      if (result.isSuccess) {
        this.showToast("Success", "Quote created successfully", "success");

        // Navigate to the new Quote record
        this.dispatchEvent(
          new CustomEvent("infopage", {
            detail: result.quoteId
          })
        );

        // Navigate to quote page
        this.navigateToViewQuote(result.quoteId);
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

  navigateToViewQuote(quoteId) {
    this[NavigationMixin.Navigate]({
      type: "standard__recordPage",
      attributes: {
        recordId: quoteId,
        objectApiName: "Quote__c",
        actionName: "view"
      }
    });
  }

  // ==================== VALIDATION ====================

  validateForm() {
    const inputFields = this.template.querySelectorAll(
      "lightning-input, lightning-combobox, lightning-textarea, select"
    );
    let isValid = true;

    inputFields.forEach((field) => {
      if (field.reportValidity && !field.reportValidity()) {
        isValid = false;
      }
    });

    // Check required fields for non-Scale
    if (!this.isScale) {
      const requiredFields = [
        "Name",
        "Marketer_UW_Name__c",
        "Carrier_Issuing_Company__c"
      ];
      for (const fieldName of requiredFields) {
        if (
          !this.quoteFields.has(fieldName) ||
          !this.quoteFields.get(fieldName)
        ) {
          isValid = false;
          this.showToast(
            "Warning",
            "Please fill in all required fields (Quote Name, Marketer/UW Name, Carrier).",
            "warning"
          );
          break;
        }
      }
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
