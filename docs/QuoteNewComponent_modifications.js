/**
 * ================================================================================
 * MODIFICATIONS REQUIRED FOR quoteNewComponent
 * ================================================================================
 *
 * This file documents the changes needed to integrate the new coverage selection
 * components into quoteNewComponent. The changes enable conditional rendering
 * based on the Coverage_Feature_Settings__mdt custom metadata.
 * ================================================================================
 */

// ================================================================================
// quoteNewComponent.js - COMPLETE MODIFIED VERSION
// ================================================================================

import { LightningElement, track, api } from "lwc";
import isScaleOpp from "@salesforce/apex/QuoteController.isScaleOpp";
import isLocationBasedPropertyEnabled from "@salesforce/apex/FeatureSettingsController.isLocationBasedPropertyEnabled";
import { ShowToastEvent } from "lightning/platformShowToastEvent";

export default class QuoteNewComponent extends LightningElement {
  @api recordId;
  @api newid;

  @track redirectQuote = false;
  @track quoteAddCoverage = false;
  @track addQuoteInfo = false;
  @track infoViewPage = false;
  @api limitToQuote;
  @track coveragesToSend;
  @track newQuoteId;
  @track showSelectRaterType = false;
  @track isScale = false;
  @api selectedRaterType;

  // NEW: Track if new property flow is enabled
  @track useNewPropertyFlow = false;
  @track coverageDataNew = null;

  async connectedCallback() {
    console.log("-----> " + this.recordId);

    try {
      // Check if location-based property is enabled org-wide
      this.useNewPropertyFlow = await isLocationBasedPropertyEnabled();

      // Check if Scale opportunity
      const oppIsScale = await isScaleOpp({ oppId: this.recordId });
      this.isScale = oppIsScale;
      this.quoteAddCoverage = !this.isScale;
      this.showSelectRaterType = this.isScale;
    } catch (error) {
      console.error("Error in connectedCallback:", error);
      this.useNewPropertyFlow = false;
      this.quoteAddCoverage = true;
    }
  }

  raterTypeChangeHandler(event) {
    console.log("event.detail", event.detail);
    this.selectedRaterType = event.detail;
    this.quoteAddCoverage = true;
    this.showSelectRaterType = false;
  }

  handlePrevious() {
    console.log("previous", this.recordId);
    isScaleOpp({
      oppId: this.recordId
    }).then((oppIsScale) => {
      this.isScale = oppIsScale;
      this.quoteAddCoverage = !this.isScale;
      this.showSelectRaterType = this.isScale;
    });
  }

  nextView() {
    this.quoteAddCoverage = !this.isScale;
    this.addQuoteInfo = false;
    this.infoViewPage = false;
  }

  infoView(e) {
    this.quoteAddCoverage = false;
    this.addQuoteInfo = false;
    this.infoViewPage = true;
    this.newQuoteId = e.detail;
  }

  cancelEvent() {
    this.quoteAddCoverage = true;
    this.addQuoteInfo = false;
    this.infoViewPage = false;
  }

  itemreceived(e) {
    console.log(e.detail);
  }

  // OLD FLOW: Handler for old component
  addQuoteInfoView(e) {
    this.limitToQuote = e.detail;
    this.quoteAddCoverage = false;
    this.addQuoteInfo = true;
    this.infoViewPage = false;
  }

  // NEW FLOW: Handler for new component
  addQuoteInfoViewNew(e) {
    this.coverageDataNew = e.detail;
    this.quoteAddCoverage = false;
    this.addQuoteInfo = true;
    this.infoViewPage = false;
  }

  handleCancel() {
    // Close the quick action
    const closeEvent = new CustomEvent("close");
    this.dispatchEvent(closeEvent);
  }

  handleError(event) {
    const errorEvent = event;
    console.log("--- event ---");
    console.log(JSON.stringify(event));
    if (errorEvent.detail.showToastError == true) {
      const toastEvent = new ShowToastEvent({
        title: "Error",
        message: errorEvent.detail.showToastMessage[0],
        variant: "error"
      });
      this.dispatchEvent(toastEvent);
    }
  }

  handleReloadView() {
    // Reload the view after save
  }
}

// ================================================================================
// quoteNewComponent.html - COMPLETE MODIFIED VERSION
// ================================================================================

/*
<template>
    <lightning-card>
        <!-- Rater Type Selection (Scale Opportunities) -->
        <template if:true={showSelectRaterType}>
            <c-rater-type-selection 
                opp-id={recordId} 
                onratertypechange={raterTypeChangeHandler}>
            </c-rater-type-selection>
        </template>
        
        <!-- Coverage Selection Step -->
        <template if:true={quoteAddCoverage}>
            <!-- NEW FLOW: Use new coverage selection component -->
            <template lwc:if={useNewPropertyFlow}>
                <c-new-quote-coverage-selection 
                    record-id={recordId}
                    selected-rater-type={selectedRaterType}
                    onprevious={handlePrevious}
                    onnextaddinfo={addQuoteInfoViewNew}
                    oncancelevent={handleCancel}>
                </c-new-quote-coverage-selection>
            </template>
            
            <!-- OLD FLOW: Use existing coverage selection component -->
            <template lwc:else>
                <c-lightning-add-remove-coverage 
                    onprevious={handlePrevious} 
                    onnextaddinfo={addQuoteInfoView} 
                    oncancelevent={handleCancel}
                    onsavelimit={handleReloadView}
                    record-id={recordId}
                    selected-rater-type={selectedRaterType}
                    selected-limits-at-u-i={limitToQuote}
                    record-id-page-context={recordId}>
                </c-lightning-add-remove-coverage>
            </template>
        </template>
        
        <!-- Quote Info Step -->
        <template if:true={addQuoteInfo}>
            <!-- NEW FLOW: Use new quote info component -->
            <template lwc:if={useNewPropertyFlow}>
                <c-new-quote-info 
                    selected-rater-type={selectedRaterType} 
                    coverage-data={coverageDataNew}
                    oninfopage={infoView} 
                    oncancelevent={cancelEvent} 
                    record-id={recordId}
                    onindicationerrorevent={handleError}>
                </c-new-quote-info>
            </template>
            
            <!-- OLD FLOW: Use existing quote info component -->
            <template lwc:else>
                <c-add-quote-info 
                    selected-rater-type={selectedRaterType} 
                    coverages={limitToQuote} 
                    oninfopage={infoView} 
                    oncancelevent={cancelEvent} 
                    record-id={recordId} 
                    onsendlimit={itemreceived}
                    onindicationerrorevent={handleError}>
                </c-add-quote-info>
            </template>
        </template>
        
        <!-- Quote View (after creation) -->
        <template if:true={infoViewPage}>
            <c-quote-base-component record-id={newQuoteId}></c-quote-base-component>
        </template>
    </lightning-card>
</template>
*/

// ================================================================================
// SUMMARY OF CHANGES
// ================================================================================
/*
1. Added import for isLocationBasedPropertyEnabled from FeatureSettingsController
2. Added @track useNewPropertyFlow property
3. Added @track coverageDataNew property for new flow data
4. Modified connectedCallback to check org-wide setting
5. Added addQuoteInfoViewNew handler for new component
6. Modified HTML template to conditionally render old/new components based on useNewPropertyFlow

FLOW DIAGRAM:
=============

                    quoteNewComponent
                          │
                          ▼
          ┌───────────────────────────────┐
          │ Check Coverage_Feature_       │
          │ Settings__mdt                 │
          │ Enable_Location_Based_        │
          │ Property__c                   │
          └───────────────────────────────┘
                          │
           ┌──────────────┴──────────────┐
           │                             │
      TRUE │                             │ FALSE
           ▼                             ▼
   ┌───────────────┐             ┌───────────────┐
   │ NEW FLOW      │             │ OLD FLOW      │
   ├───────────────┤             ├───────────────┤
   │ newQuote-     │             │ lightning-    │
   │ CoverageSelec │             │ AddRemove-    │
   │ tion          │             │ Coverage      │
   │      ↓        │             │      ↓        │
   │ newQuoteInfo  │             │ addQuoteInfo  │
   │ (Is_New_      │             │ (Is_New_      │
   │ Property__c   │             │ Property__c   │
   │ = true)       │             │ = false)      │
   └───────────────┘             └───────────────┘
*/
