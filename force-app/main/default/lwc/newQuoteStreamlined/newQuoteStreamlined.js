import { LightningElement, api, track, wire } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { NavigationMixin } from "lightning/navigation";
import getInitializationData from "@salesforce/apex/NewQuoteStreamlinedController.getInitializationData";
import createQuoteStreamlined from "@salesforce/apex/NewQuoteStreamlinedController.createQuoteStreamlined";

const PROPERTY_COVERAGE_NAME = "Property";

export default class NewQuoteStreamlined extends NavigationMixin(
  LightningElement
) {
  // ==================== PROPERTIES ====================

  @api recordId; // Opportunity Id
  @api selectedRaterType;

  // ==================== STATE ====================

  @track coverages = [];
  @track locations = [];
  isLoading = true;
  isSaving = false;
  isLocationBasedPropertyEnabled = false;

  // Track coverage selection state
  @track coverageSelections = new Map();

  // Track Property coverage locations
  @track propertyLocationSelections = new Map();
  propertyLocationSelectAll = false;

  // Account/Opportunity data
  accountName = "";
  accountId = "";

  // ==================== LIFECYCLE ====================

  @wire(getInitializationData, { opportunityId: "$recordId" })
  wiredInitData(result) {
    if (result.data) {
      this.handleInitializationSuccess(result.data);
    } else if (result.error) {
      this.handleInitializationError(result.error);
    }
  }

  // ==================== INITIALIZATION ====================

  handleInitializationSuccess(data) {
    console.log("Initialization data received: ==> ", data);

    try {
      // Store account information
      this.accountId = data.accountId;
      this.accountName = data.accountName;
      this.isLocationBasedPropertyEnabled = data.isLocationBasedPropertyEnabled;

      // Initialize coverages with selection state
      this.coverages = data.coverages.map((cov) => ({
        ...cov,
        isSelected: false,
        isProperty: cov.name === PROPERTY_COVERAGE_NAME,
        uniqueKey: cov.id
      }));

      // Initialize locations with selection state
      this.locations = (data.locations || []).map((loc) => ({
        ...loc,
        isSelected: false,
        uniqueKey: loc.id
      }));

      console.log("Coverages initialized: ==> ", this.coverages);
      console.log("Locations initialized: ==> ", this.locations);

      this.isLoading = false;
    } catch (error) {
      console.error("Error processing initialization data: ==> ", error);
      this.showToast("Error", "Failed to process initialization data", "error");
      this.isLoading = false;
    }
  }

  handleInitializationError(error) {
    console.error("Error fetching initialization data: ==> ", error);
    let errorMessage = "Failed to load initialization data";
    if (error?.body?.message) {
      errorMessage = error.body.message;
    }
    this.showToast("Error", errorMessage, "error");
    this.isLoading = false;
  }

  // ==================== COVERAGE SELECTION ====================

  handleCoverageSelection(event) {
    const coverageId = event.target.dataset.coverageId;
    const isSelected = event.target.checked;

    console.log(
      `Coverage ${coverageId} selection changed to: ==> ${isSelected}`
    );

    // Update coverage selection state
    const coverage = this.coverages.find((c) => c.id === coverageId);
    if (coverage) {
      coverage.isSelected = isSelected;

      // If deselecting Property coverage, clear location selections
      if (coverage.isProperty && !isSelected) {
        this.clearPropertyLocationSelections();
        this.propertyLocationSelectAll = false;
      }

      // Refresh the template
      this.coverages = [...this.coverages];
    }
  }

  get propertySelected() {
    return this.coverages.some((c) => c.isProperty && c.isSelected);
  }

  get propertyLocationsAvailable() {
    return (
      this.isLocationBasedPropertyEnabled &&
      this.propertySelected &&
      this.locations.length > 0
    );
  }

  get propertyLocationsNotAvailable() {
    return (
      this.isLocationBasedPropertyEnabled &&
      this.propertySelected &&
      this.locations.length === 0
    );
  }

  // ==================== PROPERTY LOCATION SELECTION ====================

  handlePropertySelectAll(event) {
    const isSelected = event.target.checked;
    console.log(`Property "Select All" changed to: ==> ${isSelected}`);

    // Toggle all location selections
    this.locations.forEach((loc) => {
      loc.isSelected = isSelected;
    });

    this.propertyLocationSelectAll = isSelected;
    this.locations = [...this.locations];
  }

  handlePropertyLocationSelection(event) {
    const locationId = event.target.dataset.locationId;
    const isSelected = event.target.checked;

    console.log(
      `Location ${locationId} selection changed to: ==>  ${isSelected}`
    );

    // Update location selection state
    const location = this.locations.find((l) => l.id === locationId);
    if (location) {
      location.isSelected = isSelected;
    }

    // Update "Select All" checkbox state if not all are selected
    const allSelected = this.locations.every((l) => l.isSelected);
    this.propertyLocationSelectAll = allSelected;

    this.locations = [...this.locations];
  }

  clearPropertyLocationSelections() {
    this.locations.forEach((loc) => {
      loc.isSelected = false;
    });
    this.propertyLocationSelectAll = false;
    this.locations = [...this.locations];
  }

  get selectedPropertyLocations() {
    return this.locations.filter((l) => l.isSelected);
  }

  // ==================== VALIDATION ====================

  validateForm() {
    // Check if at least one coverage is selected
    const selectedCoverages = this.coverages.filter((c) => c.isSelected);
    if (selectedCoverages.length === 0) {
      this.showToast(
        "Validation Error",
        "Please select at least one coverage",
        "warning"
      );
      return false;
    }

    // Check if Property coverage is selected but no locations selected
    if (this.propertySelected && this.selectedPropertyLocations.length === 0) {
      this.showToast(
        "Validation Error",
        "Please select at least one location for Property coverage",
        "warning"
      );
      return false;
    }

    return true;
  }

  // ==================== SAVE HANDLER ====================

  async handleSave() {
    if (!this.validateForm()) {
      return;
    }

    this.isSaving = true;

    try {
      // Build the payload
      const selectedCoverages = this.buildSelectedCoveragesPayload();

      console.log(
        "Saving with payload: ==> ",
        JSON.stringify(selectedCoverages)
      );

      // Call Apex controller
      const result = await createQuoteStreamlined({
        opportunityId: this.recordId,
        selectedCoveragesJson: JSON.stringify(selectedCoverages)
      });

      console.log("Save result: ==> ", result);

      if (result.isSuccess) {
        this.showToast("Success", result.message, "success");

        // Dispatch event with the new Quote Id
        this.dispatchEvent(
          new CustomEvent("quotecreated", {
            detail: {
              quoteId: result.quoteId,
              message: result.message
            }
          })
        );

        // Navigate to the new Quote record
        this.navigateToQuote(result.quoteId);
      } else {
        this.showToast("Error", result.message, "error");
        if (result.errors && result.errors.length > 0) {
          result.errors.forEach((err) => {
            console.error("Error detail: ==> ", err);
          });
        }
      }
    } catch (error) {
      console.error("Error saving quote: ==> ", error);
      this.showToast(
        "Error",
        "Failed to save quote: " + error.message,
        "error"
      );
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Build the payload for the Apex controller
   * @returns {Object} The selected coverages payload
   */
  buildSelectedCoveragesPayload() {
    const selectedCoveragesData = this.coverages
      .filter((c) => c.isSelected)
      .map((cov) => {
        const coverageData = {
          id: cov.id,
          name: cov.name,
          acronym: cov.acronym,
          selectedLocations: []
        };

        // For Property coverage, include selected locations
        if (cov.isProperty) {
          coverageData.selectedLocations = this.selectedPropertyLocations.map(
            (loc) => ({
              id: loc.id,
              name: loc.name
            })
          );
        }

        return coverageData;
      });

    return {
      opportunityId: this.recordId,
      coverages: selectedCoveragesData
    };
  }

  // ==================== NAVIGATION ====================

  navigateToQuote(quoteId) {
    this[NavigationMixin.Navigate]({
      type: "standard__recordPage",
      attributes: {
        recordId: quoteId,
        actionName: "view"
      }
    });
  }

  // ==================== CANCEL HANDLER ====================

  handleCancel() {
    this.dispatchEvent(new CustomEvent("cancelevent"));
  }

  // ==================== TOAST NOTIFICATIONS ====================

  showToast(title, message, variant) {
    const event = new ShowToastEvent({
      title: title,
      message: message,
      variant: variant,
      mode: "dismissable"
    });
    this.dispatchEvent(event);
  }

  // ==================== GETTERS FOR TEMPLATE ====================

  get selectedCoverageCount() {
    return this.coverages.filter((c) => c.isSelected).length;
  }

  get selectedLocationCount() {
    return this.locations.filter((l) => l.isSelected).length;
  }

  get nonPropertyCoverages() {
    return this.coverages.filter((c) => !c.isProperty);
  }

  get propertyCoverage() {
    return this.coverages.find((c) => c.isProperty);
  }

  get saveButtonDisabled() {
    return this.isSaving || this.isLoading;
  }

  get saveButtonLabel() {
    return this.isSaving ? "Saving..." : "Save";
  }

  get pageTitle() {
    return `Create Quote - Select Coverages (${this.accountName})`;
  }

  get summaryText() {
    const covCount = this.selectedCoverageCount;
    const locCount = this.selectedLocationCount;
    let summary = `Selected: ${covCount} coverage(s)`;
    if (this.propertySelected) {
      summary += `, ${locCount} location(s)`;
    }
    return summary;
  }
}