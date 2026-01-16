import { LightningElement, api, track } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getInitializationData from "@salesforce/apex/NewQuoteCoverageSelectionController.getInitializationData";
import saveNewQuoteWithCoverages from "@salesforce/apex/NewQuoteCoverageSelectionController.saveNewQuoteWithCoverages";

const PROPERTY_COVERAGE_NAME = "Property";

export default class NewQuoteCoverageSelection extends NavigationMixin(
  LightningElement
) {
  @api recordId; // Opportunity Id
  @api selectedRaterType;

  // State management
  isLoading = true;
  loadSpinner = false;
  currentStep = "selection"; // 'selection', 'configuration'
  searchTerm = "";

  // Data from Apex
  @track initData = {};
  @track coverages = [];
  @track locations = [];
  @track fieldSets = [];

  // Record context
  opportunityId = null;
  accountId = null;
  accountName = "";
  isScale = false;
  raterType = "";
  isLocationBasedPropertyEnabled = false;

  // Coverage configuration
  @track propertyLocationSelections = new Map(); // locationId -> {isSelected, fields}
  @track coverageFieldValues = new Map(); // coverageName -> {fieldApiName -> value}

  // ==================== LIFECYCLE ====================

  connectedCallback() {
    this.loadInitializationData();
  }

  // ==================== GETTERS ====================

  get isSelectionStep() {
    return this.currentStep === "selection";
  }

  get isConfigurationStep() {
    return this.currentStep === "configuration";
  }

  get filteredCoverages() {
    if (!this.searchTerm) {
      return this.coverages;
    }
    const term = this.searchTerm.toLowerCase();
    return this.coverages.filter((cov) =>
      cov.name.toLowerCase().includes(term)
    );
  }

  get hasLocations() {
    return this.locations && this.locations.length > 0;
  }

  get locationCount() {
    return this.locations ? this.locations.length : 0;
  }

  get selectedCoverageCount() {
    return this.coverages.filter((cov) => cov.isSelected).length;
  }

  get hasSelectedCoverages() {
    return this.selectedCoverageCount > 0;
  }

  get isPropertySelected() {
    return this.coverages.some(
      (cov) => cov.name === PROPERTY_COVERAGE_NAME && cov.isSelected
    );
  }

  get showPropertyLocationWarning() {
    return (
      this.isPropertySelected &&
      this.isLocationBasedPropertyEnabled &&
      !this.hasLocations
    );
  }

  get canProceedToConfiguration() {
    if (!this.hasSelectedCoverages) {
      return false;
    }
    if (this.showPropertyLocationWarning) {
      return false;
    }
    return true;
  }

  get canNotProceedToConfiguration() {
    return !this.canProceedToConfiguration;
  }

  get selectedCoveragesForConfiguration() {
    return this.coverages
      .filter((cov) => cov.isSelected && cov.name !== PROPERTY_COVERAGE_NAME)
      .map((cov) => {
        const fieldSet = this.fieldSets.find(
          (fs) => fs.coverageName === cov.name
        );
        const fieldValues = this.coverageFieldValues.get(cov.name);

        return {
          ...cov,
          fields: fieldSet
            ? fieldSet.fields.map((f) => ({
                ...f,
                value: fieldValues?.fields?.get(f.fieldApiName) || "",
                inputType: this.getInputType(f.fieldType),
                isTextarea: f.fieldType === "TEXTAREA",
                isCheckbox: f.fieldType === "BOOLEAN",
                isDate: f.fieldType === "DATE",
                isNumber: this.isNumericType(f.fieldType),
                step: this.getStep(f.fieldType),
                formatter: this.getFormatter(f.fieldType),
                uniqueFieldKey: `${cov.name}_${f.fieldApiName}`
              }))
            : []
        };
      });
  }

  get propertyFieldSet() {
    return this.fieldSets.find(
      (fs) => fs.coverageName === PROPERTY_COVERAGE_NAME
    );
  }

  get locationsForPropertyConfiguration() {
    if (
      !this.isPropertySelected ||
      !this.isLocationBasedPropertyEnabled ||
      !this.hasLocations
    ) {
      return [];
    }

    const propertyFieldSet = this.propertyFieldSet;
    if (!propertyFieldSet) return [];

    return this.locations.map((loc) => {
      const selectionData = this.propertyLocationSelections.get(loc.id) || {
        isSelected: false,
        fields: new Map()
      };

      return {
        ...loc,
        isSelected: selectionData.isSelected,
        uniqueKey: `prop-loc-${loc.id}`,
        fields: propertyFieldSet.fields.map((f) => ({
          ...f,
          // Use pre-populated value from Location if available, otherwise empty
          value: selectionData.fields.get(f.fieldApiName) ?? "",
          inputType: this.getInputType(f.fieldType),
          isTextarea: f.fieldType === "TEXTAREA",
          isPicklist: f.fieldType === "PICKLIST",
          isCheckbox: f.fieldType === "BOOLEAN",
          isDate: f.fieldType === "DATE",
          isNumber: [
            "CURRENCY",
            "PERCENT",
            "DOUBLE",
            "DECIMAL",
            "INTEGER"
          ].includes(f.fieldType),
          step:
            f.fieldType === "PERCENT"
              ? "0.01"
              : f.fieldType === "INTEGER"
                ? "1"
                : "0.01",
          formatter:
            f.fieldType === "CURRENCY"
              ? "currency"
              : f.fieldType === "PERCENT"
                ? "percent"
                : null,
          uniqueFieldKey: `${loc.id}-${f.fieldApiName}`,
          // ADD: Flag to indicate if value was pre-populated (optional, for UI indication)
          isPrePopulated:
            loc.fieldValues && loc.fieldValues[f.fieldApiName] !== undefined
        }))
      };
    });
  }

  get selectedLocationCount() {
    let count = 0;
    this.propertyLocationSelections.forEach((data) => {
      if (data.isSelected) count++;
    });
    return count;
  }

  // ==================== DATA LOADING ====================

  async loadInitializationData() {
    this.isLoading = true;
    try {
      const result = await getInitializationData({
        opportunityId: this.recordId,
        raterType: this.selectedRaterType
      });

      if (result.hasError) {
        this.showToast("Error", result.errorMessage, "error");
        return;
      }

      this.initData = result;
      this.opportunityId = result.opportunityId;
      this.accountId = result.accountId;
      this.accountName = result.accountName;
      this.isScale = result.isScale;
      this.raterType = result.raterType;
      this.isLocationBasedPropertyEnabled =
        result.isLocationBasedPropertyEnabled;
      this.fieldSets = result.coverageFieldSets || [];
      this.locations = result.accountLocations || [];
      this.locationFieldMappings = result.locationFieldMappings || []; // ADD THIS LINE

      console.log("location ==> ", JSON.parse(JSON.stringify(this.locations)));
      console.log(
        "location field mapping ==> ",
        JSON.parse(JSON.stringify(this.locationFieldMappings))
      );

      // Initialize coverages
      this.initializeCoverages(result.availableCoverages);

      // Initialize property location selections with pre-populated values
      this.initializePropertyLocationSelections();
    } catch (error) {
      console.error("Error loading data:", error);
      this.showToast(
        "Error",
        "Failed to load coverage data: " + this.getErrorMessage(error),
        "error"
      );
    } finally {
      this.isLoading = false;
    }
  }

  initializeCoverages(availableCoverages) {
    this.coverages = availableCoverages.map((cov) => ({
      ...cov,
      locationBadge:
        cov.isProperty && this.isLocationBasedPropertyEnabled
          ? `(${this.locations.length} locations)`
          : ""
    }));
  }

  initializePropertyLocationSelections() {
    this.propertyLocationSelections = new Map();

    for (const location of this.locations) {
      // Pre-populate fields from Location record's fieldValues
      const prePopulatedFields = new Map();

      if (location.fieldValues) {
        // Iterate through the field values returned from Apex
        for (const [fieldApiName, value] of Object.entries(
          location.fieldValues
        )) {
          if (value !== null && value !== undefined) {
            prePopulatedFields.set(fieldApiName, value);
          }
        }
      }

      this.propertyLocationSelections.set(location.id, {
        isSelected: false,
        fields: prePopulatedFields
      });
    }
  }

  // ==================== EVENT HANDLERS ====================

  handleSearchChange(event) {
    this.searchTerm = event.target.value;
  }

  handleCoverageToggle(event) {
    const coverageName = event.target.dataset.coverageName;
    const isChecked = event.target.checked;

    this.coverages = this.coverages.map((cov) => {
      if (cov.name === coverageName) {
        return { ...cov, isSelected: isChecked };
      }
      return cov;
    });
  }

  handleLocationToggle(event) {
    const locationId = event.target.dataset.locationId;
    const isChecked = event.target.checked;

    const locationData = this.propertyLocationSelections.get(locationId);
    if (locationData) {
      this.propertyLocationSelections.set(locationId, {
        ...locationData,
        isSelected: isChecked
      });
      // Force reactivity
      this.propertyLocationSelections = new Map(
        this.propertyLocationSelections
      );
    }
  }

  // to delete method
  handleFieldChange(event) {
    const coverageName = event.target.dataset.coverageName;
    const fieldApiName = event.target.dataset.fieldApiName;
    const locationId = event.target.dataset.locationId;
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;

    if (
      coverageName === PROPERTY_COVERAGE_NAME &&
      locationId &&
      this.isLocationBasedPropertyEnabled
    ) {
      // Property coverage with location
      const locationData = this.propertyLocationSelections.get(locationId);
      if (locationData) {
        locationData.fields.set(fieldApiName, value);
        this.propertyLocationSelections.set(locationId, locationData);
      }
    } else {
      // Regular coverage
      let coverageData = this.coverageFieldValues.get(coverageName);
      if (!coverageData) {
        coverageData = { fields: new Map() };
      }
      coverageData.fields.set(fieldApiName, value);
      this.coverageFieldValues.set(coverageName, coverageData);
    }
  }

  // ==================== NAVIGATION ====================

  handleNext() {
    if (!this.canProceedToConfiguration) {
      if (this.showPropertyLocationWarning) {
        this.showToast(
          "Warning",
          "Please add locations to the Account before adding Property coverage.",
          "warning"
        );
      } else {
        this.showToast(
          "Warning",
          "Please select at least one coverage.",
          "warning"
        );
      }
      return;
    }

    this.currentStep = "configuration";
  }

  handleBack() {
    if (this.currentStep === "configuration") {
      this.currentStep = "selection";
    } else {
      // Go back to previous component (rater type selection)
      this.dispatchEvent(new CustomEvent("previous"));
    }
  }

  handleCancel() {
    this.dispatchEvent(new CustomEvent("cancelevent"));
  }

  // ==================== VALIDATION ====================

  validateRequiredFields() {
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

  // ==================== DATA BUILDING ====================

  buildCoverageData() {
    const coverageFieldData = [];

    // Build data for regular coverages
    for (const cov of this.coverages.filter(
      (c) => c.isSelected && c.name !== PROPERTY_COVERAGE_NAME
    )) {
      const fieldValues = this.coverageFieldValues.get(cov.name);
      const fieldSet = this.fieldSets.find(
        (fs) => fs.coverageName === cov.name
      );

      if (fieldSet) {
        for (const field of fieldSet.fields) {
          const value = fieldValues?.fields?.get(field.fieldApiName) || "";
          coverageFieldData.push({
            coverageName: cov.name,
            fieldApiName: field.fieldApiName,
            fieldValue: String(value),
            fieldType: field.fieldType,
            locationId: null,
            isProperty: false
          });
        }
      }
    }

    // Build data for Property coverage with locations (if enabled and selected)
    if (this.isPropertySelected && this.isLocationBasedPropertyEnabled) {
      const propertyFieldSet = this.propertyFieldSet;

      this.propertyLocationSelections.forEach((data, locationId) => {
        if (data.isSelected && propertyFieldSet) {
          for (const field of propertyFieldSet.fields) {
            const value = data.fields?.get(field.fieldApiName) || "";
            coverageFieldData.push({
              coverageName: PROPERTY_COVERAGE_NAME,
              fieldApiName: field.fieldApiName,
              fieldValue: String(value),
              fieldType: field.fieldType,
              locationId: locationId,
              isProperty: true
            });
          }
        }
      });
    }

    return {
      coverageFieldData: coverageFieldData,
      isNewPropertyEnabled: this.isLocationBasedPropertyEnabled,
      raterType: this.raterType
    };
  }

  // ==================== UTILITIES ====================

  getInputType(fieldType) {
    switch (fieldType) {
      case "DATE":
        return "date";
      case "DATETIME":
        return "datetime";
      case "BOOLEAN":
        return "checkbox";
      case "INTEGER":
      case "DOUBLE":
      case "CURRENCY":
      case "PERCENT":
      case "DECIMAL":
        return "number";
      default:
        return "text";
    }
  }

  isNumericType(fieldType) {
    return ["CURRENCY", "PERCENT", "DOUBLE", "DECIMAL", "INTEGER"].includes(
      fieldType
    );
  }

  getStep(fieldType) {
    switch (fieldType) {
      case "INTEGER":
        return "1";
      case "CURRENCY":
      case "PERCENT":
      case "DOUBLE":
      case "DECIMAL":
        return "0.01";
      default:
        return null;
    }
  }

  getFormatter(fieldType) {
    switch (fieldType) {
      case "CURRENCY":
        return "currency";
      case "PERCENT":
        return "percent-fixed";
      default:
        return null;
    }
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

  // ==================== SAVE HANDLER ====================

  async handleSaveNewQuote() {
    // Validate required fields
    if (!this.validateRequiredFields()) {
      return;
    }

    this.loadSpinner = true;

    // Build coverage data to pass to next step
    const coverageDataToSave = this.buildCoverageData();

    try {
      console.log("coverage data ==> ", coverageDataToSave);

      // Build save request
      const saveRequest = {
        opportunityId: this.recordId,
        raterType: this.raterType,
        isNewPropertyEnabled: this.isLocationBasedPropertyEnabled,
        quoteFields: null,
        coverageFieldData: coverageDataToSave?.coverageFieldData || []
      };

      console.log("save request ==> ", JSON.stringify(saveRequest));

      // Save quote with coverages
      const result = await saveNewQuoteWithCoverages({
        saveRequest: JSON.stringify(saveRequest)
      });

      console.log("save result ==> ", result);

      if (result.isSuccess) {
        this.showToast("Success", "Quote created successfully", "success");

        // Navigate to quote page
        this.navigateToViewQuote(result.quoteId);
      } else {
        this.showToast("Error", result.message, "error");
        this.dispatchIndicationError(result.message);
      }
    } catch (error) {
      console.error("Error saving quote: ==> ", error);
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
}
