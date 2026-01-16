import { LightningElement, api, track } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { CloseActionScreenEvent } from "lightning/actions";
import getInitializationData from "@salesforce/apex/CoverageSelectionController.getInitializationData";
import createDummyQuote from "@salesforce/apex/CoverageSelectionController.createDummyQuote";
import saveCoverages from "@salesforce/apex/CoverageSelectionController.saveCoverages";

const PROPERTY_COVERAGE_NAME = "Property";

export default class CoverageSelection extends LightningElement {
  _recordId;

  @api set recordId(value) {
    this._recordId = value;
    this.loadInitializationData();
  }
  get recordId() {
    return this._recordId;
  }

  @api recordIdPageContext;

  // State management
  isLoading = true;
  currentStep = "selection"; // 'selection', 'configuration', 'dummyQuote'
  searchTerm = "";
  searchLocationTerm = "";

  // Data from Apex
  @track initData = {};
  @track coverages = [];
  @track locations = [];
  @track fieldSets = [];
  @track existingLinks = [];

  // Record context
  sObjectType = "";
  quoteId = null;
  policyId = null;
  endorsementId = null;
  opportunityId = null;
  isNewPropertyEnabled = false;

  // Coverage configuration
  @track selectedCoverages = [];
  @track coveragesToDelete = [];
  @track propertyLocationSelections = new Map(); // locationId -> {isSelected, fields, existingLinkId}
  @track coverageFieldValues = new Map(); // coverageName -> {fieldApiName -> value}

  // UI state
  @track expandedSections = new Set();

  // ==================== LIFECYCLE ====================

  connectedCallback() {
    // this.loadInitializationData();
  }

  // ==================== GETTERS ====================

  get effectiveRecordId() {
    return this.recordId || this.recordIdPageContext;
  }

  get isSelectionStep() {
    return this.currentStep === "selection";
  }

  get isConfigurationStep() {
    return this.currentStep === "configuration";
  }

  get isDummyQuoteStep() {
    return this.currentStep === "dummyQuote";
  }

  get isNotDummyQuoteStep() {
    return !this.isDummyQuoteStep;
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

  get filteredLocationForConfiguration() {
    if (!this.searchLocationTerm) {
      return this.propertyLocationsForConfiguration;
    }
    const term = this.searchLocationTerm.toLowerCase();
    return this.propertyLocationsForConfiguration.filter((loc) =>
      loc.name.toLowerCase().includes(term)
    );
  }

  get hasLocations() {
    return this.locations && this.locations.length > 0;
  }

  get propertyLocationSelectAll() {
    const allSelected = this.propertyLocationSelections
      .values()
      .every((l) => l.isSelected);
    return allSelected;
  }

  get locationCount() {
    return this.locations ? this.locations.length : 0;
  }

  get isPropertySelected() {
    return this.coverages.some(
      (cov) => cov.name === PROPERTY_COVERAGE_NAME && cov.isSelected
    );
  }

  get showPropertyLocationWarning() {
    return (
      this.isNewPropertyEnabled && this.isPropertySelected && !this.hasLocations
    );
  }

  get selectedCoveragesForConfiguration() {
    return this.coverages.filter((cov) => cov.isSelected);
  }

  get nonPropertyCoveragesForConfiguration() {
    return this.selectedCoveragesForConfiguration.filter(
      (cov) => cov.name !== PROPERTY_COVERAGE_NAME
    );
  }

  get propertyFieldSet() {
    return this.fieldSets.find(
      (fs) => fs.coverageName === PROPERTY_COVERAGE_NAME
    );
  }

  get hasSelectedCoverages() {
    return this.selectedCoveragesForConfiguration.length > 0;
  }

  get canProceedToConfiguration() {
    // if (!this.hasSelectedCoverages) return false;
    if (this.showPropertyLocationWarning) return false;
    return true;
  }

  get canNotProceedToConfiguration() {
    return !this.canProceedToConfiguration;
  }

  get stepIndicatorClass() {
    return "slds-progress";
  }

  get selectionStepClass() {
    return this.currentStep === "selection"
      ? "slds-progress__item slds-is-active"
      : "slds-progress__item slds-is-completed";
  }

  get configurationStepClass() {
    return this.currentStep === "configuration"
      ? "slds-progress__item slds-is-active"
      : "slds-progress__item";
  }

  // ==================== DATA LOADING ====================

  async loadInitializationData() {
    this.isLoading = true;
    try {
      console.log("record id ==> ", this.effectiveRecordId);

      const result = await getInitializationData({
        recordId: this.effectiveRecordId
      });

      console.log("result ==> ", result);

      if (result.hasError) {
        this.showToast("Error", result.errorMessage, "error");
        return;
      }

      this.initData = result;
      this.sObjectType = result.sObjectType;
      this.quoteId = result.quoteId;
      this.policyId = result.policyId;
      this.endorsementId = result.endorsementId;
      this.opportunityId = result.opportunityId;
      this.isNewPropertyEnabled = result.isNewPropertyEnabled;
      this.fieldSets = result.coverageFieldSets || [];
      this.existingLinks = result.existingCoverageLinks || [];
      this.locations = result.accountLocations || [];

      // Check if dummy quote is needed
      if (result.requiresDummyQuote && this.sObjectType !== "Quote__c") {
        this.currentStep = "dummyQuote";
      }

      // Initialize coverages with selection state
      this.initializeCoverages(result.availableCoverages);

      // Initialize property location selections
      this.initializePropertyLocationSelections();
    } catch (error) {
      console.error("Error loading data: ==> ", error);
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
    // Create a set of existing coverage names
    const existingCoverageNames = new Set(
      this.existingLinks.map((link) => link.name)
    );

    this.coverages = availableCoverages.map((cov) => ({
      ...cov,
      isSelected: existingCoverageNames.has(cov.name),
      originallySelected: existingCoverageNames.has(cov.name)
    }));

    // Sort: selected first, then alphabetically
    this.coverages.sort((a, b) => {
      if (a.isSelected !== b.isSelected) {
        return a.isSelected ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    // Initialize field values from existing links
    this.initializeFieldValues();
  }

  initializeFieldValues() {
    this.coverageFieldValues = new Map();

    for (const link of this.existingLinks) {
      if (!link.isProperty || !this.isNewPropertyEnabled) {
        const fieldValues = new Map();
        const fieldSet = this.fieldSets.find(
          (fs) => fs.coverageName === link.name
        );

        if (fieldSet && link.record) {
          for (const field of fieldSet.fields) {
            const value = link.record[field.fieldApiName];
            if (value !== undefined && value !== null) {
              fieldValues.set(field.fieldApiName, value);
            }
          }
        }

        this.coverageFieldValues.set(link.name, {
          existingLinkId: link.id,
          fields: fieldValues
        });
      }
    }
  }

  initializePropertyLocationSelections() {
    this.propertyLocationSelections = new Map();

    // Get existing Property links with locations
    const existingPropertyLinks = this.existingLinks.filter(
      (link) => link.name === PROPERTY_COVERAGE_NAME && link.isProperty
    );

    // Create a map of locationId to existing link
    const existingByLocation = new Map();
    for (const link of existingPropertyLinks) {
      if (link.locationId) {
        existingByLocation.set(link.locationId, link);
      }
    }

    // Initialize selection state for each location
    for (const location of this.locations) {
      const existingLink = existingByLocation.get(location.id);
      const fieldValues = new Map();

      if (existingLink && existingLink.record) {
        const propertyFieldSet = this.propertyFieldSet;
        if (propertyFieldSet) {
          for (const field of propertyFieldSet.fields) {
            const value = existingLink.record[field.fieldApiName];
            if (value !== undefined && value !== null) {
              fieldValues.set(field.fieldApiName, value);
            }
          }
        }
      }

      this.propertyLocationSelections.set(location.id, {
        isSelected: !!existingLink,
        originallySelected: !!existingLink,
        existingLinkId: existingLink ? existingLink.id : null,
        fields: fieldValues,
        locationName: location.name,
        locationDescription: location.description
      });
    }
  }

  // ==================== EVENT HANDLERS ====================

  handleSearchChange(event) {
    this.searchTerm = event.target.value;
  }

  handleSearchLocationChange(event) {
    this.searchLocationTerm = event.target.value;
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

  handleFieldChange(event) {
    const coverageName = event.target.dataset.coverageName;
    const fieldApiName = event.target.dataset.fieldApiName;
    const locationId = event.target.dataset.locationId;
    const value = event.target.value;

    if (
      coverageName === PROPERTY_COVERAGE_NAME &&
      locationId &&
      this.isNewPropertyEnabled
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

  handleSectionToggle(event) {
    const sectionId = event.target.dataset.sectionId;
    if (this.expandedSections.has(sectionId)) {
      this.expandedSections.delete(sectionId);
    } else {
      this.expandedSections.add(sectionId);
    }
    // Force reactivity
    this.expandedSections = new Set(this.expandedSections);
  }

  isSectionExpanded(sectionId) {
    return this.expandedSections.has(sectionId);
  }

  // ==================== LOCATION SELECTION ====================

  handleLocationSelectAll(event) {
    const isSelected = event.target.checked;
    console.log(`Location "Select All" changed to: ==> ${isSelected}`);

    // Toggle all location selections
    this.propertyLocationSelections.values().forEach((loc) => {
      loc.isSelected = isSelected;
    });

    // Force reactivity
    this.propertyLocationSelections = new Map(this.propertyLocationSelections);
  }

  handleLocationToggle(event) {
    const locationId = event.target.dataset.locationId;
    const isSelected = event.target.checked;

    console.log(
      `Location ${locationId} selection changed to: ==>  ${isSelected}`
    );

    const locationData = this.propertyLocationSelections.get(locationId);
    if (locationData) {
      this.propertyLocationSelections.set(locationId, {
        ...locationData,
        isSelected: isSelected
      });

      // Force reactivity
      this.propertyLocationSelections = new Map(
        this.propertyLocationSelections
      );
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

    // Expand all sections by default
    this.expandedSections = new Set();
    for (const cov of this.selectedCoveragesForConfiguration) {
      this.expandedSections.add(cov.name);
    }

    this.currentStep = "configuration";
  }

  handleBack() {
    this.currentStep = "selection";
  }

  handleCancel() {
    this.dispatchEvent(new CustomEvent("cancelevent"));
    this.dispatchEvent(new CloseActionScreenEvent());
  }

  // ==================== DUMMY QUOTE ====================

  async handleCreateDummyQuote() {
    this.isLoading = true;
    try {
      const newQuoteId = await createDummyQuote({
        opportunityId: this.opportunityId
      });
      this.quoteId = newQuoteId;
      this.currentStep = "selection";
      this.showToast("Success", "Dummy quote created successfully.", "success");
    } catch (error) {
      this.showToast(
        "Error",
        "Failed to create dummy quote: " + this.getErrorMessage(error),
        "error"
      );
    } finally {
      this.isLoading = false;
    }
  }

  // ==================== SAVE LOGIC ====================

  async handleSave() {
    this.isLoading = true;

    try {
      // Validate required fields
      if (!this.validateRequiredFields()) {
        this.isLoading = false;
        return;
      }

      const saveRequest = this.buildSaveRequest();

      console.log("save request ==> ", saveRequest);

      const result = await saveCoverages({
        saveRequest: JSON.stringify(saveRequest)
      });

      console.log("result ==> ", result);

      if (result.isSuccess) {
        this.showToast("Success", result.message, "success");
        this.dispatchEvent(new CustomEvent("savelimit"));
        this.dispatchEvent(new CustomEvent("reloadviewpage"));

        if (this.sObjectType !== "Quote__c") {
          this.dispatchEvent(new CloseActionScreenEvent());
        }
      } else {
        this.showToast("Error", result.message, "error");
      }
    } catch (error) {
      console.error("Save error: ==> ", error);
      this.showToast(
        "Error",
        "Failed to save coverages: " + this.getErrorMessage(error),
        "error"
      );
    } finally {
      this.isLoading = false;
    }
  }

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

  buildSaveRequest() {
    const request = {
      quoteId: this.quoteId,
      policyId: this.policyId,
      endorsementId: this.endorsementId,
      coveragesToDelete: [],
      coverageFieldData: []
    };

    // Determine coverages to delete
    for (const cov of this.coverages) {
      if (cov.originallySelected && !cov.isSelected) {
        // Coverage was deselected
        if (cov.name === PROPERTY_COVERAGE_NAME && this.isNewPropertyEnabled) {
          // Delete all Property links for all locations
          for (const [locationId, locationData] of this
            .propertyLocationSelections) {
            if (locationData.existingLinkId) {
              request.coveragesToDelete.push(locationData.existingLinkId);
            }
          }
        } else {
          // Delete regular coverage
          const existingLink = this.existingLinks.find(
            (link) => link.name === cov.name
          );
          if (existingLink) {
            request.coveragesToDelete.push(existingLink.id);
          }
        }
      }
    }

    // Handle Property location deletions (when Property is selected but specific locations are deselected)
    if (this.isPropertySelected && this.isNewPropertyEnabled) {
      for (const [locationId, locationData] of this
        .propertyLocationSelections) {
        if (
          locationData.originallySelected &&
          !locationData.isSelected &&
          locationData.existingLinkId
        ) {
          if (
            !request.coveragesToDelete.includes(locationData.existingLinkId)
          ) {
            request.coveragesToDelete.push(locationData.existingLinkId);
          }
        }
      }
    }

    // Build coverage field data for upsert
    for (const cov of this.selectedCoveragesForConfiguration) {
      const fieldSet = this.fieldSets.find(
        (fs) => fs.coverageName === cov.name
      );
      if (!fieldSet) continue;

      if (cov.name === PROPERTY_COVERAGE_NAME && this.isNewPropertyEnabled) {
        // Property coverage - create entry for each selected location
        for (const [locationId, locationData] of this
          .propertyLocationSelections) {
          if (locationData.isSelected) {
            for (const field of fieldSet.fields) {
              request.coverageFieldData.push({
                coverageName: cov.name,
                fieldApiName: field.fieldApiName,
                fieldValue: String(
                  locationData.fields.get(field.fieldApiName) || ""
                ),
                fieldType: field.fieldType,
                quoteCoverageLinkId: locationData.existingLinkId,
                locationId: locationId,
                isProperty: true
              });
            }
          }
        }
      } else {
        // Regular coverage
        const coverageData = this.coverageFieldValues.get(cov.name) || {
          fields: new Map()
        };
        const existingLink = this.existingLinks.find(
          (link) => link.name === cov.name
        );

        for (const field of fieldSet.fields) {
          request.coverageFieldData.push({
            coverageName: cov.name,
            fieldApiName: field.fieldApiName,
            fieldValue: String(
              coverageData.fields.get(field.fieldApiName) || ""
            ),
            fieldType: field.fieldType,
            quoteCoverageLinkId: existingLink ? existingLink.id : null,
            locationId: null,
            isProperty: false
          });
        }
      }
    }

    return request;
  }

  // ==================== UTILITIES ====================

  showToast(title, message, variant) {
    this.dispatchEvent(
      new ShowToastEvent({
        title: title,
        message: message,
        variant: variant
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
    return "Unknown error occurred";
  }

  // ==================== TEMPLATE HELPERS ====================

  get locationsForTemplate() {
    return this.locations.map((loc) => {
      const selectionData = this.propertyLocationSelections.get(loc.id) || {
        isSelected: false,
        fields: new Map()
      };
      return {
        ...loc,
        isSelected: selectionData.isSelected,
        uniqueKey: `loc-${loc.id}`
      };
    });
  }

  getFieldValue(coverageName, fieldApiName, locationId = null) {
    if (
      coverageName === PROPERTY_COVERAGE_NAME &&
      locationId &&
      this.isNewPropertyEnabled
    ) {
      const locationData = this.propertyLocationSelections.get(locationId);
      return locationData ? locationData.fields.get(fieldApiName) : "";
    }
    const coverageData = this.coverageFieldValues.get(coverageName);
    return coverageData ? coverageData.fields.get(fieldApiName) : "";
  }

  getCoverageFieldSet(coverageName) {
    return this.fieldSets.find((fs) => fs.coverageName === coverageName);
  }

  get configurableCoverages() {
    return this.selectedCoveragesForConfiguration.map((cov) => {
      const fieldSet = this.getCoverageFieldSet(cov.name);
      const isProperty = cov.name === PROPERTY_COVERAGE_NAME;
      const coverageData = this.coverageFieldValues.get(cov.name) || {
        fields: new Map(),
        existingLinkId: null
      };

      return {
        ...cov,
        fieldSet: fieldSet,
        isPropertyWithLocations:
          isProperty && this.isNewPropertyEnabled && this.hasLocations,
        isExpanded: this.expandedSections.has(cov.name),
        sectionId: cov.name,
        existingLinkId: coverageData.existingLinkId,
        fields: fieldSet
          ? fieldSet.fields.map((f) => ({
              ...f,
              value: coverageData.fields.get(f.fieldApiName) || "",
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
                    : null
            }))
          : []
      };
    });
  }

  get propertyLocationsForConfiguration() {
    if (
      !this.isPropertySelected ||
      !this.isNewPropertyEnabled ||
      !this.hasLocations
    ) {
      return [];
    }

    const propertyFieldSet = this.propertyFieldSet;
    if (!propertyFieldSet) return [];

    return this.locations.map((loc) => {
      const selectionData = this.propertyLocationSelections.get(loc.id) || {
        isSelected: false,
        existingLinkId: null,
        fields: new Map()
      };

      return {
        ...loc,
        isSelected: selectionData.isSelected,
        existingLinkId: selectionData.existingLinkId,
        uniqueKey: `prop-loc-${loc.id}`,
        fields: propertyFieldSet.fields.map((f) => ({
          ...f,
          value: selectionData.fields.get(f.fieldApiName) || "",
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
          uniqueFieldKey: `${loc.id}-${f.fieldApiName}`
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

  getInputType(fieldType) {
    const typeMap = {
      STRING: "text",
      TEXTAREA: "text",
      EMAIL: "email",
      PHONE: "tel",
      URL: "url",
      CURRENCY: "number",
      PERCENT: "number",
      DOUBLE: "number",
      DECIMAL: "number",
      INTEGER: "number",
      DATE: "date",
      DATETIME: "datetime",
      BOOLEAN: "checkbox"
    };
    return typeMap[fieldType] || "text";
  }
}
