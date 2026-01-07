import { LightningElement, api } from 'lwc';

export default class RaterTypeSelection extends LightningElement {
    @api oppId;
    value = '--None--';

    get options() {
        return [
            { label: 'Matrix', value: 'MATRIX' },
            { label: 'Excess', value: 'EXCESS' },
            { label: 'Exotics', value: 'EXOTICS' },
            { label: 'Tech', value: 'TECH' },
            { label: 'FMP', value: 'FMP' },
            { label: 'Other', value: 'ML' },

        ];
    }

    handleChange(event) {
        this.value = event.detail.value;
        let inputFields = this.template.querySelectorAll(".validate");
        inputFields.forEach((inputField) => {
            inputField.setCustomValidity("");
            inputField.reportValidity();
        });
    }

    handleNextView() {
        if (this.value !== '--None--') {
            this.dispatchEvent(new CustomEvent("ratertypechange", { detail: this.value }));
        }
        else {
            let inputFields = this.template.querySelectorAll(".validate");
            inputFields.forEach((inputField) => {
                inputField.setCustomValidity("Complete this field.");
                inputField.reportValidity();
            });
        }
    }
    
}